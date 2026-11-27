import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {decompile} from '../src/decompile.ts';
import {analyzeBindings} from '../src/analysis/Bindings.ts';
import {printWithoutCallBoundaries} from './helpers.ts';
it.each([0,1,2])('protects a prototype name from earlier fallback temporaries at O%s',level=>{
  const bytes=readFileSync(new URL(`./fixtures/rewrites/reassigned-function-name-O${level}.luauc`,import.meta.url));
  const result=decompile(bytes,{opcodeEncoding:'official'});
  expect(result.ok).toBe(true);
  if(!result.ok)throw Error(result.error);
  expect(result.source).toContain('local function result()');
  expect(printWithoutCallBoundaries(result.ast).match(/debug\.info\(result, "n"\)/g)).toHaveLength(2);
  const calls:any[]=[];
  const visit=(node:any):void=>{
    if(!node||typeof node!=='object')return;
    if(node.kind==='call'&&node.callee.kind==='property'&&node.callee.name==='info'&&node.callee.object.name==='debug')calls.push(node);
    Object.values(node).forEach(value=>Array.isArray(value)?value.forEach(visit):visit(value));
  };
  visit(result.ast);
  expect(calls).toHaveLength(2);
  const bindings=analyzeBindings(result.ast.body).bindings;
  const named=bindings.find(binding=>binding.declaration.kind==='function-decl'&&binding.name==='result');
  expect(named).toBeDefined();
  for(const call of calls)expect(bindings.find(binding=>binding.reads.some(read=>read.node===call.args[0]))).toBe(named);
  // O0 reaches debug.info through GETTABLEKS; retain both indirect CALLs.
  if(level===0)expect(result.source.match(/\(if true then debug\.info else nil\)\(result, "n"\)/g)).toHaveLength(2);
});
