import {readFileSync} from 'node:fs';
import {it,expect} from 'vitest';
import {decompile} from '../src/decompile.ts';
import {analyzeBindings} from '../src/analysis/Bindings.ts';
it('assigns nested phi alternatives to bindings owned by the enclosing split',()=>{
 const result=decompile(readFileSync(new URL('./fixtures/pr58/branch-phis-O0.luauc',import.meta.url)),{opcodeEncoding:'official'});
 expect(result.ok).toBe(true);
 if(!result.ok) return;
 const bindings=analyzeBindings(result.ast.body).bindings;
 const uninitialized=bindings.filter(b=>b.declaration.kind==='local'&&b.declaration.values.length===0&&b.reads.length>0&&b.writes.length===0);
 expect(uninitialized).toEqual([]);
 const choose=bindings.find(b=>b.name==='choose')!;
 const fn=choose.declaration.kind==='function-decl'?{kind:'function',body:choose.declaration.body}:choose.declaration.kind==='local'?choose.declaration.values[0]:undefined;
 expect(fn?.kind).toBe('function');
 if(fn?.kind!=='function') return;
 const outer=fn.body.statements.find(s=>s.kind==='if');
 expect(outer?.kind==='if'&&outer.consequent.statements.some(s=>s.kind==='local')).toBe(false);
});
