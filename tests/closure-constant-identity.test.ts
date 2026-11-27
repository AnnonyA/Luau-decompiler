import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {decompile} from '../src/decompile.ts';
import {analyzeBindings} from '../src/analysis/Bindings.ts';
it('retains one native closure constant and separately evaluates its two loads',()=>{
 const r=decompile(readFileSync(new URL('./fixtures/object-optimized/duplicate-closure-constant-O2.luauc',import.meta.url)),{opcodeEncoding:'official'});
 expect(r.ok).toBe(true);if(!r.ok)throw Error(r.error);
 const pairs:Array<[object,object]>=[];
 const visit=(node:any):void=>{if(!node||typeof node!=='object')return;if(node.kind==='binary'&&node.op==='=='&&node.left.kind==='identifier'&&node.right.kind==='identifier')pairs.push([node.left,node.right]);Object.values(node).forEach(v=>Array.isArray(v)?v.forEach(visit):visit(v));};visit(r.ast);
 expect(pairs).toHaveLength(1);
 const bindings=analyzeBindings(r.ast.body).bindings;
 const owner=(node:object)=>bindings.find(b=>b.reads.some(x=>x.node===node));
 const first=owner(pairs[0]![0]),second=owner(pairs[0]![1]);
 expect(first).toBeDefined();expect(second).toBeDefined();
 // One source alias was an invalid invariant: a host can change main's
 // environment before entry, making these two native loads distinct clones.
 // The permanent host A/B/A runtime gate verifies both outcomes.
 expect(first).not.toBe(second);
 const load=(binding:typeof first)=>{
  const declaration=binding!.declaration;
  expect(declaration.kind).toBe('local');
  if(declaration.kind!=='local')throw Error('expected a materialized load');
  const value=declaration.values[0]!;expect(value.kind).toBe('call');
  if(value.kind!=='call')throw Error('expected native carrier call');
  return value;
 };
 const firstLoad=load(first),secondLoad=load(second);
 const carrier=owner(firstLoad.callee);
 expect(carrier).toBeDefined();expect(owner(secondLoad.callee)).toBe(carrier);
 const declaration=carrier!.declaration;
 expect(declaration.kind).toBe('function-decl');
 if(declaration.kind!=='function-decl')throw Error('expected native carrier');
 expect(declaration.isVararg).toBe(true); // O2 must not inline the carrier.
 expect(declaration.body.statements).toHaveLength(1);
 const returned=declaration.body.statements[0]!;
 expect(returned.kind).toBe('return');
 if(returned.kind!=='return')throw Error('expected one shared physical literal');
 expect(returned.values).toHaveLength(1);
 expect(returned.values[0]!.kind).toBe('function-expr');
});
