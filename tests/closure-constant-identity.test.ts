import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {decompile} from '../src/decompile.ts';
import {analyzeBindings} from '../src/analysis/Bindings.ts';
it('shares the binding loaded from one closure constant at two inlined O2 sites',()=>{
 const r=decompile(readFileSync(new URL('./fixtures/object-optimized/duplicate-closure-constant-O2.luauc',import.meta.url)),{opcodeEncoding:'official'});
 expect(r.ok).toBe(true);if(!r.ok)throw Error(r.error);
 const pairs:Array<[object,object]>=[];
 const visit=(node:any):void=>{if(!node||typeof node!=='object')return;if(node.kind==='binary'&&node.op==='=='&&node.left.kind==='identifier'&&node.right.kind==='identifier')pairs.push([node.left,node.right]);Object.values(node).forEach(v=>Array.isArray(v)?v.forEach(visit):visit(v));};visit(r.ast);
 expect(pairs).toHaveLength(1);
 const bindings=analyzeBindings(r.ast.body).bindings;
 const owner=(node:object)=>bindings.find(b=>b.reads.some(x=>x.node===node));
 expect(owner(pairs[0]![0])).toBeDefined();
 expect(owner(pairs[0]![0])).toBe(owner(pairs[0]![1]));
});
