import {expect, it} from 'vitest';
import {readFileSync} from 'node:fs';
import {block, chunk, ident, lit, type Expression} from '../src/ast/Ast.ts';
import {printLuau} from '../src/print/LuauPrinter.ts';
import {formatDecompiledSource, DECOMPILER_VERSION} from '../src/print/SourcePresentation.ts';

it('labels output with the real engine and bytecode versions and an unambiguous UTC date',()=>{
  const version=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).version;
  expect(DECOMPILER_VERSION).toBe(version);
  expect(formatDecompiledSource({source:'return 1\n',module:{version:9,typesVersion:3}},new Date('2026-11-07T01:37:51-03:00')))
    .toBe(`-- [[ annonya.github.io ]] v${version} | decompiled at 2026-11-07T04:37:51Z\n-- Luau bytecode version: 9 | Luau type version: 3\n\nreturn 1\n`);
});
it('keeps bytecode and type versions separate, including absent type metadata',()=>{
  expect(formatDecompiledSource({source:'return\n',module:{version:3,typesVersion:0}},new Date(0)))
    .toContain('Luau bytecode version: 3 | Luau type version: 0\n\nreturn\n');
});
it('prints an existing function binding as a named assignment and separates the next declaration',()=>{
  const fn:Expression={kind:'function-expr',debugName:'helper',params:['value'],isVararg:false,body:block([{kind:'return',values:[ident('value')]}])};
  expect(printLuau(chunk([
    {kind:'local',names:['helper'],values:[]},
    {kind:'assign',targets:[ident('helper')],values:[fn]},
    {kind:'local',names:['result'],values:[lit(7)]},
  ]))).toBe('local helper\nfunction helper(value)\n    return value\nend\n\nlocal result = 7\n');
});
it('does not invent or change the observable debug name of an assigned closure',()=>{
  for(const debugName of [undefined,'original']) {
    const fn:Expression={kind:'function-expr',debugName,params:[],isVararg:false,body:block([])};
    expect(printLuau(chunk([{kind:'assign',targets:[ident('renamed')],values:[fn]}])))
      .toBe('renamed = function()\nend\n');
  }
});
it('keeps parallel function assignments and indexed target evaluation intact',()=>{
  const fn:Expression={kind:'function-expr',params:[],isVararg:false,body:block([{kind:'return',values:[lit(1)]}])};
  const source=printLuau(chunk([
    {kind:'assign',targets:[ident('first'),ident('second')],values:[fn,lit(null)]},
    {kind:'assign',targets:[{kind:'index',table:ident('object'),key:{kind:'call',callee:ident('key'),args:[],open:false}}],values:[fn]},
  ]));
  expect(source).toContain('first, second = function()');
  expect(source).toContain('object[key()] = function()');
});
