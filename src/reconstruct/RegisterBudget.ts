import type {Block} from '../ast/Ast.js';
import type {LexicalBinding} from '../analysis/Bindings.js';

/** Conservative budget for rewrites that introduce live locals. Count the
 * entire AST instead of guessing disjoint lifetimes. Official Luau reserves
 * numeric-for limit/step/index registers and generic-for generator/state/index
 * plus at least two variable slots. Reserve all three/four beyond named locals,
 * covering written numeric indices as well. Not a general register allocator. */
export function rewriteRegisterCount(bindings: readonly LexicalBinding[], root: Block): number {
  let count=bindings.length;
  const loops=new Set<object>();
  for(const binding of bindings) {
    const declaration=binding.declaration;
    if(loops.has(declaration))continue;
    if(declaration.kind==='numeric-for' || declaration.kind==='generic-for') {
      loops.add(declaration);
      count+=declaration.kind==='numeric-for'?3:4;
    }
  }
  // Wide packs and nested expressions need registers even with no named
  // locals. In particular, right-nested binaries keep every left value live;
  // counting only args/values arrays can underestimate by an arbitrary amount.
  // Calls reserve their argument window before evaluating the callee, not only
  // while walking their args array. Charge both operand/result temporaries and
  // the complete call window conservatively. Function bodies start a new frame.
  let width=0, budget=100_000;
  const pending:Array<[unknown,number]>=[[root,0]];
  while(pending.length) {
    if(--budget<0)return Infinity;
    const [node,held]=pending.pop()!;
    if(!node || typeof node!=='object')continue;
    const record=node as {kind?:string;args?:unknown[];fields?:unknown[];parts?:unknown[];targets?:unknown[]};
    let extra=0;
    switch(record.kind) {
      case 'binary': case 'index': case 'if-expr': extra=2;break;
      case 'unary': case 'property': extra=1;break;
      case 'call': extra=(record.args?.length ?? 0)+2;break;
      case 'method-call': extra=(record.args?.length ?? 0)+3;break;
      case 'table': extra=(record.fields?.length ?? 0)+2;break;
      case 'interp': extra=(record.parts?.length ?? 0)+4;break;
      case 'assign': extra=2*(record.targets?.length ?? 0);break;
      case 'compound-assign': extra=3;break;
    }
    const active=held+extra;
    width=Math.max(width,active);
    for(const [key,value] of Object.entries(node)) {
      if(key==='closureIdentity')continue;
      if(key==='body' && (record.kind==='function-expr' || record.kind==='function-decl')) {
        pending.push([value,0]);continue;
      }
      const charged=(key==='args' && (record.kind==='call' || record.kind==='method-call')) ||
        (key==='fields' && record.kind==='table');
      const reserve=active+(!charged && Array.isArray(value) && ['args','values','fields','iterators'].includes(key)?value.length+2:0);
      width=Math.max(width,reserve);
      if(value && typeof value==='object')pending.push([value,reserve]);
    }
  }
  return count+width;
}
