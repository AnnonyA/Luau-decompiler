import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {decompile} from '../src/decompile.ts';
import {analyzeBindings} from '../src/analysis/Bindings.ts';
it('exports inlined numeric-loop results to the caller without unconditionally running the exhaustion tail',()=>{
 const result=decompile(readFileSync(new URL('./fixtures/object-optimized/inlined-loop-exits-O2.luauc',import.meta.url)),{opcodeEncoding:'official',recoverInlinedFunctions:false});
 expect(result.ok).toBe(true);if(!result.ok)throw Error(result.error);
 const bindings=analyzeBindings(result.ast.body).bindings;
 const found=bindings.find(b=>b.scope===result.ast.body && b.writes.length>=2 && b.reads.some(r=>r.statement.kind==='expression-stmt'));
 expect(found).toBeDefined();
 expect(result.ast.body.statements.filter(s=>s.kind==='if')).toHaveLength(2);
});
it.each(['returned-loop-cell','returned-variable-loop-cell'].flatMap(name=>[0,1,2].map(optimization=>({name,optimization}))))('keeps the returned closure on its original cell in $name O$optimization',({name,optimization})=>{
 const result=decompile(readFileSync(new URL(`./fixtures/object-optimized/${name}-O${optimization}.luauc`,import.meta.url)),{opcodeEncoding:'official'});
 expect(result.ok).toBe(true);if(!result.ok)throw Error(result.error);
 const cells=analyzeBindings(result.ast.body).bindings.filter(b=>b.captured && b.declaration.kind==='local' && b.declaration.values[0]?.kind==='literal' && b.declaration.values[0].value===0);
 expect(cells.length).toBeGreaterThan(0);
 for(const cell of cells){
  expect(cell.writes.some(w=>w.statement.kind==='assign' && w.statement.values[0]?.kind==='literal' && w.statement.values[0].value===9)).toBe(true);
  expect(cell.writes.some(w=>w.statement.kind==='assign' && w.statement.values[0]?.kind==='identifier' && w.statement.values[0].name==='print')).toBe(false);
 }
});
