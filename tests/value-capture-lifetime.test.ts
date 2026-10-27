import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {decompile} from '../src/decompile.ts';
import {analyzeBindings} from '../src/analysis/Bindings.ts';
import type {Expression,Statement} from '../src/ast/Ast.ts';
it.each([1,2])('keeps a VAL checkpoint capture local to its loop activation at O%i',optimization=>{
 const bytes=readFileSync(new URL(`../benchmarks/independent-2026-10-27/bytecode/incremental-workbook/O${optimization}.luauc`,import.meta.url));
 const result=decompile(bytes,{opcodeEncoding:'official'});
 expect(result.ok).toBe(true);if(!result.ok)throw Error(result.error);
 const bindings=analyzeBindings(result.ast.body).bindings;
 const checkpoints:Expression[]=[];
 function walk(node:unknown):void{
  if(!node||typeof node!=='object')return;
  const value=node as Expression|Statement;
  if(value.kind==='function-expr' && value.params.length===0){
   const ret=value.body.statements.find(s=>s.kind==='return');
   if(ret?.kind==='return'&&ret.values.length===3)checkpoints.push(ret.values[0]!);
  }
  Object.values(node).forEach(child=>Array.isArray(child)?child.forEach(walk):walk(child));
 }
 walk(result.ast);
 expect(checkpoints).toHaveLength(1);
 const binding=bindings.find(b=>b.reads.some(r=>r.node===checkpoints[0]));
 expect(binding).toBeDefined();
 expect(binding!.scope).not.toBe(result.ast.body);
 expect(binding!.writes).toHaveLength(0);
});
