import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {decompile} from '../src/decompile.ts';
it.each([0,1,2])('protects a prototype name from earlier fallback temporaries at O%s',level=>{
  const bytes=readFileSync(new URL(`./fixtures/rewrites/reassigned-function-name-O${level}.luauc`,import.meta.url));
  const result=decompile(bytes,{opcodeEncoding:'official'});
  expect(result.ok).toBe(true);
  if(!result.ok)throw Error(result.error);
  expect(result.source).toContain('local function result()');
  expect(result.source).toContain('debug.info(result,');
});
