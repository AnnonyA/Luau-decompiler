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
  // Wide argument/return/constructor packs need registers even with no named
  // locals. Bound this scan and accumulate nested packs: earlier outer arguments stay live during inner calls.
  let width=0, budget=100_000;
  const pending:Array<[unknown,number]>=[[root,0]];
  while(pending.length) {
    if(--budget<0)return Infinity;
    const [node,held]=pending.pop()!;
    if(!node || typeof node!=='object')continue;
    for(const [key,value] of Object.entries(node)) {
      const reserve=held+(Array.isArray(value) && ['args','values','fields','iterators'].includes(key)?value.length+2:0);
      width=Math.max(width,reserve);
      if(value && typeof value==='object')pending.push([value,reserve]);
    }
  }
  return count+width;
}
