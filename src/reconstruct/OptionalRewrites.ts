import {block,ident,lit,type Block,type Chunk,type Expression,type Statement} from '../ast/Ast.js';
import {analyzeBindings,replaceReferences,type LexicalBinding} from '../analysis/Bindings.js';
import {numericStateBindings} from './NumericState.js';
import {isValidIdentifier} from './Naming.js';
import {rewriteRegisterCount} from './RegisterBudget.js';

export interface OptionalRewriteOptions {
  mathConstants?: boolean;
  rerollUnrolledLoops?: boolean;
  keepDeadFunctions?: boolean;
  unfoldModuleTables?: boolean;
}

const arithmetic = new Set(['+','-','*','/','//','%','^']);
const constants = [['PI',Math.PI],['TAU',2*Math.PI],['E',Math.E],['SQRT2',Math.SQRT2],['LN2',Math.LN2]] as const;

/** Enumerate containers once, bounding recursive analyses before running them. */
function objects(root: object): object[] | undefined {
  const result: object[] = [], pending: Array<[object,number]> = [[root,0]];
  while(pending.length) {
    const [node,depth]=pending.pop()!;
    if(depth>96 || result.length>=100_000)return undefined;
    result.push(node);
    for(const value of Object.values(node))if(value && typeof value==='object')pending.push([value,depth+1]);
  }
  return result;
}

function allocator(bindings: readonly LexicalBinding[], globals: ReadonlySet<string>): (base:string)=>string {
  const used=new Set([...globals,...bindings.map(binding=>binding.name)]);
  return base=>{
    let name=base,index=2;
    while(used.has(name))name=`${base}_${index++}`;
    used.add(name);return name;
  };
}

/** Independently implemented bounded structural rewrites. Whole-binding writer
 * checks follow the invariant discussed in Tovek 77edf387 deinline_safety.rs;
 * integer unit strides mirror the exact bounded subset of official Luau
 * 9d7748a4 compileUnrolledFor. No external implementation code is copied. */
export function applyOptionalRewrites(ast: Chunk, options: OptionalRewriteOptions = {}): Chunk {
  let result=structuredClone(ast);
  if(!options.mathConstants && !options.rerollUnrolledLoops && options.keepDeadFunctions!==false && !options.unfoldModuleTables)return result;
  const nodes=objects(result);
  if(!nodes)return result;
  const {bindings,globals}=options.mathConstants || options.rerollUnrolledLoops || options.keepDeadFunctions===false
    ? analyzeBindings(result.body) : {bindings:[],globals:new Set<string>()};
  const fresh=allocator(bindings,globals);
  const blocks=nodes.filter((node):node is Block=>(node as Block).kind==='block');
  // Reserve headroom for the new loop control registers and constant locals.
  // Counting all bindings is conservative even when their lifetimes differ.
  const canAddLocals=rewriteRegisterCount(bindings, result.body)<180;
  if(options.rerollUnrolledLoops && canAddLocals)reroll(blocks,bindings,fresh);
  if(options.keepDeadFunctions===false)removeDeadFunctions(blocks,bindings);
  if(options.unfoldModuleTables===true)unfoldTables(blocks);
  if(options.mathConstants && canAddLocals) {
    // Re-enumerate after structural changes: do not count removed literals or
    // introduce a constant declaration based on a dead helper's body.
    const current=objects(result);
    if(!current)return result;
    const replacements=new Map<object,object>(), declarations: Statement[]=[];
    for(const [base,value] of constants) {
      const occurrences=current.filter(node=>(node as Expression).kind==='literal' && Object.is((node as {value:unknown}).value,value));
      if(occurrences.length<2)continue;
      const name=fresh(base);
      declarations.push({kind:'local',names:[name],values:[lit(value)]});
      for(const node of occurrences)replacements.set(node,ident(name));
    }
    if(declarations.length) {
      result=replaceReferences(result,replacements);
      result.body.statements.unshift(...declarations);
    }
  }
  return result;
}

function removeDeadFunctions(blocks: readonly Block[], bindings: readonly LexicalBinding[]): void {
  const removable=new Set<Statement>();
  for(const binding of bindings) {
    if(binding.reads.length || binding.writes.length)continue;
    const declaration=binding.declaration;
    if(declaration.kind==='function-decl' && declaration.local && binding.declarationIndex===undefined && binding.scope!==declaration.body)
      removable.add(declaration);
    if(declaration.kind==='local' && declaration.names.length===1 && declaration.values.length===1 && declaration.values[0]?.kind==='function-expr')
      removable.add(declaration);
  }
  for(const body of blocks)body.statements=body.statements.filter(statement=>!removable.has(statement));
}

function unfoldTables(blocks: readonly Block[]): void {
  for(const body of blocks)body.statements=body.statements.flatMap((statement):Statement[]=>{
    if(statement.kind!=='local' || statement.names.length!==1 || statement.values.length!==1)return [statement];
    const table=statement.values[0],name=statement.names[0]!;
    if(table?.kind!=='table' || !table.fields.some(field=>field.value.kind==='function-expr'))return [statement];
    const names=new Set<string>();
    for(const field of table.fields) {
      if(field.list || field.key || !field.name || !isValidIdentifier(field.name) || names.has(field.name) ||
        field.value.kind!=='literal' && field.value.kind!=='function-expr')return [statement];
      names.add(field.name);
    }
    // In `local M = {run = function() return M end}`, M inside the
    // initializer resolves to the *preceding* scope. Moving creation after the
    // declaration must not silently capture the new table instead.
    const values=objects(table);
    if(!values || values.some(node=>{
      const value=node as Expression | Statement;
      return value.kind==='identifier' && value.name===name ||
        value.kind==='function-decl' && value.name.split(/[.:]/)[0]===name;
    }))return [statement];
    return [{...statement,values:[{kind:'table',fields:[]}]},...table.fields.map((field):Statement=>({
      kind:'assign',targets:[{kind:'property',object:ident(name),name:field.name!}],values:[field.value],
    }))];
  });
}

function reroll(blocks: readonly Block[], bindings: readonly LexicalBinding[], fresh:(base:string)=>string): void {
  let budget=100_000;
  const spend=()=>--budget>=0;
  const owners=new Map<object,LexicalBinding>();
  for(const binding of bindings)for(const ref of [...binding.reads,...binding.writes])owners.set(ref.node,binding);
  const memo=new Map<LexicalBinding,boolean>(),active=new Set<LexicalBinding>();
  function immutableNumeric(expression:Expression,depth=0):boolean {
    if(!spend() || depth>32)return false;
    if(expression.kind==='literal')return typeof expression.value==='number';
    if(expression.kind==='paren')return immutableNumeric(expression.expression,depth+1);
    if(expression.kind==='unary')return expression.op==='-' && immutableNumeric(expression.argument,depth+1);
    if(expression.kind==='binary')return arithmetic.has(expression.op) && immutableNumeric(expression.left,depth+1) && immutableNumeric(expression.right,depth+1);
    if(expression.kind!=='identifier')return false;
    const owner=owners.get(expression);
    if(!owner || owner.writes.length || active.has(owner))return false;
    if(memo.has(owner))return memo.get(owner)!;
    active.add(owner);
    const declaration=owner.declaration;
    const valid=declaration.kind==='local' && declaration.names.length===1 && declaration.values.length===1 &&
      immutableNumeric(declaration.values[0]!,depth+1);
    active.delete(owner);memo.set(owner,valid);return valid;
  }
  const numeric=numericStateBindings(bindings,owners,immutableNumeric,spend);
  type Update=Extract<Statement,{kind:'compound-assign'}>;
  const eligible=(statement:Statement|undefined):statement is Update=>statement?.kind==='compound-assign' &&
    statement.target.kind==='identifier' && arithmetic.has(statement.op) && numeric.has(owners.get(statement.target)!);
  for(const body of blocks) {
    const output:Statement[]=[];
    for(let index=0;index<body.statements.length;) {
      const first=body.statements[index]!,second=body.statements[index+1];
      if(!spend() || !eligible(first) || !eligible(second) || first.op!==second.op || owners.get(first.target)!==owners.get(second.target)) {
        output.push(first);index++;continue;
      }
      const varying=new Set<object>();
      let start:number|undefined,step:number|undefined;
      function match(a:Expression,b:Expression,iteration:number,discover=false,depth=0):boolean {
        if(!spend() || depth>32 || a.kind!==b.kind)return false;
        if(a.kind==='literal' && b.kind==='literal') {
          if(typeof a.value!=='number' || typeof b.value!=='number')return false;
          if(discover && !Object.is(a.value,b.value)) {
            const delta=b.value-a.value;
            if(!Number.isSafeInteger(a.value) || !Number.isSafeInteger(b.value) || Object.is(a.value,-0) || Object.is(b.value,-0) || Math.abs(delta)!==1)return false;
            if(start!==undefined && (!Object.is(start,a.value) || step!==delta))return false;
            start=a.value;step=delta;varying.add(a);return true;
          }
          return varying.has(a)?Object.is(b.value,start!+iteration*step!):Object.is(a.value,b.value);
        }
        if(a.kind==='identifier' && b.kind==='identifier')return owners.get(a)===owners.get(b) && immutableNumeric(a);
        if(a.kind==='paren' && b.kind==='paren')return match(a.expression,b.expression,iteration,discover,depth+1);
        if(a.kind==='unary' && b.kind==='unary')return a.op==='-' && b.op==='-' && match(a.argument,b.argument,iteration,discover,depth+1);
        return a.kind==='binary' && b.kind==='binary' && a.op===b.op && arithmetic.has(a.op) &&
          match(a.left,b.left,iteration,discover,depth+1) && match(a.right,b.right,iteration,discover,depth+1);
      }
      if(!match(first.value,second.value,1,true) || start===undefined) {output.push(first);index++;continue;}
      let end=index+2;
      while(end<body.statements.length && end-index<256) {
        const next=body.statements[end];
        if(!eligible(next) || next.op!==first.op || owners.get(next.target)!==owners.get(first.target) ||
          !Number.isSafeInteger(start+(end-index)*step!) || !match(first.value,next.value,end-index))break;
        end++;
      }
      if(end-index<3) {output.push(first);index++;continue;}
      const name=fresh('i'), replacements=new Map<object,object>();
      for(const node of varying)replacements.set(node,ident(name));
      output.push({kind:'numeric-for',name,start:lit(start),stop:lit(start+(end-index-1)*step!),
        ...(step===-1?{step:lit(-1)}:{}),body:block([{...first,value:replaceReferences(first.value,replacements)}])});
      index=end;
    }
    body.statements=output;
  }
}
