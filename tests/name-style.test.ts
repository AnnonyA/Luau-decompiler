import { expect, it } from 'vitest';
import { block, chunk, ident, lit } from '../src/ast/Ast.ts';
import { styleLocalNames } from '../src/reconstruct/NameStyle.ts';
import { analyzeBindings } from '../src/analysis/Bindings.ts';
import { printLuau } from '../src/print/LuauPrinter.ts';
import { parseQueryOptions } from '../src/decompile.ts';

it.each([
  ['camelCase', 'httpServerId'], ['snake_case', 'http_server_id'], ['PascalCase', 'HttpServerId'],
] as const)('formats acronym boundaries using %s', (nameCasing, expected) => {
  const ast = chunk([{kind:'local', names:['HTTPServerID'], values:[lit(1)]}, {kind:'return', values:[ident('HTTPServerID')]}]);
  const renamed = styleLocalNames(ast, {nameCasing});
  expect(printLuau(renamed)).toContain(`return ${expected}`);
  expect(printLuau(ast)).toContain('return HTTPServerID');
});

it('keeps shadowed closure bindings distinct and avoids free globals', () => {
  const ast = chunk([
    {kind:'local', names:['PlayerCount'], values:[ident('playerCount')]},
    {kind:'local', names:['callback'], values:[{kind:'function-expr', params:['PlayerCount'], isVararg:false,
      body:block([{kind:'return', values:[ident('PlayerCount'), ident('v1')]}])}]},
    {kind:'return', values:[ident('PlayerCount'), ident('callback')]},
  ]);
  const renamed = styleLocalNames(ast, {generatedNames:'compact'});
  const {bindings, globals} = analyzeBindings(renamed.body);
  expect([...globals].sort()).toEqual(['playerCount','v1']);
  expect(bindings.map(b=>b.name)).toEqual(['v2','v3','v4']);
  expect(bindings.map(b=>b.reads.length)).toEqual([1,1,1]);
  expect(printLuau(renamed)).toContain('return v3, v1');
  expect(printLuau(renamed)).toContain('return v2, v4');
});

it('renames a declaration root without changing its public path or implicit self', () => {
  const ast = chunk([
    {kind:'local', names:['MyModule'], values:[{kind:'table',fields:[]}]},
    {kind:'function-decl', name:'MyModule.Sub.GetValue', local:false, params:['InputValue'], isVararg:false,
      body:block([{kind:'return',values:[ident('InputValue'),ident('MyModule')]}])},
    {kind:'function-decl', name:'MyModule:GetValue', local:false, params:[], isVararg:false,
      body:block([{kind:'return',values:[ident('self')]}])},
  ]);
  const source=printLuau(styleLocalNames(ast,{nameCasing:'snake_case'}));
  expect(source).toContain('function my_module.Sub.GetValue(input_value)');
  expect(source).toContain('return input_value, my_module');
  expect(source).toContain('function my_module:GetValue()');
  expect(source).toContain('return self');
});

it('keeps the recursive function name separate from a parameter with the same spelling', () => {
  const ast=chunk([{kind:'function-decl',local:true,name:'MyFunction',params:['MyFunction'],isVararg:false,
    body:block([{kind:'return',values:[ident('MyFunction')]}])}, {kind:'return',values:[ident('MyFunction')]}]);
  expect(printLuau(styleLocalNames(ast,{generatedNames:'compact'}))).toContain('local function v1(v2)\n    return v2');
});

it('preserves names mentioned by opaque type annotations', () => {
  const ast=chunk([{kind:'local',names:['MyObject'],values:[ident('game')]},
    {kind:'local',names:['MyCopy'],types:['typeof(MyObject)'],values:[ident('MyObject')]}]);
  const source=printLuau(styleLocalNames(ast,{nameCasing:'snake_case'}));
  expect(source).toContain('local MyObject = game');
  expect(source).toContain('local my_copy: typeof(MyObject) = MyObject');
});

it('reserves future local names and avoids keywords after casing',()=>{
  const ast=chunk([{kind:'local',names:['End','ItemCount','item_count'],values:[lit(1),lit(2),lit(3)]},
    {kind:'return',values:[ident('End'),ident('ItemCount'),ident('item_count')]}]);
  expect(printLuau(styleLocalNames(ast,{nameCasing:'snake_case'}))).toContain('return end_, item_count2, item_count');
});

it('validates query naming options and preserves defaults for invalid values',()=>{
  expect(parseQueryOptions(new URLSearchParams('generated_names=compact&name_casing=snake_case'))).toMatchObject({generatedNames:'compact',nameCasing:'snake_case'});
  expect(parseQueryOptions(new URLSearchParams('generated_names=bad&name_casing=bad'))).toMatchObject({generatedNames:'readable',nameCasing:'preserve'});
});

it('treats shared identifier nodes as separate lexical occurrences',()=>{
  const shared=ident('ItemCount');
  const ast=chunk([{kind:'local',names:['ItemCount'],values:[lit(3)]},
    {kind:'local',names:['callback'],values:[{kind:'function-expr',params:['ItemCount'],isVararg:false,body:block([{kind:'return',values:[shared]}])}]},
    {kind:'return',values:[shared]}]);
  const source=printLuau(styleLocalNames(ast,{generatedNames:'compact'}));
  expect(source).toContain('return v2\nend');
  expect(source).toContain('\nreturn v1\n');
});

it('renames duplicate declarations by position, preserving the last binding',()=>{
  const ast=chunk([{kind:'local',names:['ItemCount','ItemCount'],values:[lit(1),lit(2)]},
    {kind:'return',values:[ident('ItemCount')]}]);
  expect(printLuau(styleLocalNames(ast,{generatedNames:'compact'}))).toContain('local v1, v2 = 1, 2\nreturn v2');
});
