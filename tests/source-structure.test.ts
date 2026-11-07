import {expect,it} from 'vitest';
import {block,chunk,ident,lit,type Expression,type Statement} from '../src/ast/Ast.ts';
import {cleanupAst} from '../src/ast/AstCleanup.ts';
import {defaultCleanupOptions} from '../src/decompile.ts';
import {inferHumanNames} from '../src/reconstruct/NameInference.ts';
import {printLuau} from '../src/print/LuauPrinter.ts';
import {analyzeBindings} from '../src/analysis/Bindings.ts';

const call=(name:string,args:Expression[]=[]):Expression=>({kind:'call',callee:ident(name),args,open:false});
const local=(name:string,value:Expression):Statement=>({kind:'local',names:[name],values:[value]});
const use=(name:string):Statement=>({kind:'expression-stmt',expression:call('observe',[ident(name)])});
const guard=():Statement=>({kind:'if',test:ident('stop'),consequent:block([{kind:'return',values:[]}]),branches:[],
  alternate:block([local('item',call('fetch')),use('item')])});
const clean=(statements:Statement[])=>cleanupAst(chunk(statements),defaultCleanupOptions({ifExpressions:false,earlyContinue:false}));

it('flattens a terminal function guard whose else declares locals',()=>{
  const result=clean([{kind:'function-decl',local:true,name:'refresh',params:[],isVararg:false,body:block([guard()])}]);
  expect(printLuau(result)).toContain('if stop then\n        return\n    end\n');
  expect(printLuau(result)).not.toContain('else');
  expect(printLuau(result)).toContain('    local item = fetch()');
});
it('does not extend else locals into a following statement or a repeat condition',()=>{
  const value=guard();
  expect(printLuau(clean([value,use('item')]))).toContain('else');
  expect(printLuau(clean([{kind:'repeat',body:block([guard()]),test:ident('item')}]))).toContain('else');
});
it('folds an adjacent single-use comparison into its return',()=>{
  const result=inferHumanNames(chunk([local('result',{kind:'binary',op:'<',left:ident('a'),right:ident('b')}),
    {kind:'return',values:[ident('result')]}]));
  expect(printLuau(result)).toBe('return a < b\n');
});
it('keeps the fixed one-result adjustment when returning a call or varargs',()=>{
  for(const value of [call('many'),{kind:'vararg'}] as Expression[]) {
    const result=inferHumanNames(chunk([local('result',value),{kind:'return',values:[ident('result')]}]));
    expect(printLuau(result)).toBe(value.kind==='vararg'?'return (...)\n':'return (many())\n');
  }
});
it('retains captured return cells and does not erase an assigned function debug name',()=>{
  const fn:Expression={kind:'function-expr',params:[],isVararg:false,body:block([{kind:'return',values:[ident('result')]}])};
  expect(printLuau(inferHumanNames(chunk([local('result',lit(1)),local('reader',fn),use('reader'),{kind:'return',values:[ident('result')]}]))))
    .toContain('local result');
  expect(printLuau(inferHumanNames(chunk([local('result',fn),{kind:'return',values:[ident('result')]}]))))
    .toContain('local result');
});
const child=():Expression=>({kind:'table',fields:[{name:'folder',value:ident('folder')},{name:'entries',value:{kind:'table',fields:[]}}]});
const parent=():Statement=>local('categories',{kind:'table',fields:[{name:'Nukes',value:ident('Nukes')}]});
it('assembles a named private child table with stable local dependencies into its parent',()=>{
  const ast=chunk([local('folder',call('fetch')),local('Nukes',child()),use('other'),parent(),{kind:'return',values:[ident('categories')]}]);
  const source=printLuau(inferHumanNames(ast));
  expect(source).not.toContain('local Nukes');
  expect(source).toContain('Nukes = {');
  expect(source).toContain('folder = folder');
});
it('does not move a table dependency across reassignment, shadowing or a closure write',()=>{
  const changes:Statement[]=[{kind:'assign',targets:[ident('folder')],values:[call('nextFolder')]},
    local('folder',call('nextFolder')),
    {kind:'function-decl',local:true,name:'mutate',params:[],isVararg:false,body:block([
      {kind:'assign',targets:[ident('folder')],values:[call('nextFolder')]},
    ])}];
  for(const change of changes) {
    const ast=chunk([local('folder',call('fetch')),local('Nukes',child()),change,parent(),{kind:'return',values:[ident('categories')]}]);
    expect(printLuau(inferHumanNames(ast))).toContain('local Nukes');
  }
});
it('prints nested records as readable multiline fields',()=>{
  const record:Expression={kind:'table',fields:['entries','discovered','folder'].map(name=>({name,value:lit(null)}))};
  const source=printLuau(chunk([local('categories',{kind:'table',fields:[{name:'Nukes',value:record}]})]));
  expect(source).toContain('Nukes = {\n        entries = nil,\n        discovered = nil,\n        folder = nil,\n    }');
});
it('keeps a table binding when it is an assignment target or a call receiver',()=>{
  for(const statement of [
    {kind:'assign',targets:[{kind:'property',object:ident('config'),name:'value'}],values:[call('nextValue')]},
    {kind:'expression-stmt',expression:{kind:'method-call',object:ident('config'),name:'run',args:[],open:false}},
  ] as Statement[]) {
    const source=printLuau(inferHumanNames(chunk([local('config',{kind:'table',fields:[]}),statement])));
    expect(source).toContain('local config');
    expect(source).not.toContain('({})');
  }
});
it('combines adjacent private method receivers without moving argument evaluation',()=>{
  const wait=(object:Expression,name:string,args:Expression[]=[]):Expression=>({kind:'method-call',object,name:'WaitForChild',args:[lit(name),...args],open:false});
  const result=inferHumanNames(chunk([local('gui',wait(ident('player'),'Gui')),
    local('panel',wait(ident('gui'),'Panel',[call('timeout')])),{kind:'return',values:[ident('panel')]}]));
  expect(printLuau(result)).toContain('player:WaitForChild("Gui"):WaitForChild("Panel", timeout())');
  expect(printLuau(result)).not.toContain('local gui');
  const aliased=inferHumanNames(chunk([local('gui',wait(ident('player'),'Gui')),
    local('panel',wait(ident('gui'),'Panel',[ident('gui')])),{kind:'return',values:[ident('panel')]}]));
  expect(printLuau(aliased)).toContain('local gui');
});
it('separates top-level services, imports and function definitions without reordering them',()=>{
  const source=printLuau(chunk([
    local('Players',{kind:'method-call',object:ident('game'),name:'GetService',args:[lit('Players')],open:false}),
    local('Store',call('require',[ident('modulePath')])),local('active',lit(false)),
    {kind:'function-decl',local:true,name:'refresh',params:[],isVararg:false,body:block([])},
  ]));
  expect(source).toBe('local Players = game:GetService("Players")\n\nlocal Store = require(modulePath)\n\nlocal active = false\n\nlocal function refresh()\nend\n');
});
it.each([false,true])('retains a method receiver read by a repeat condition (closure: %s)',captured=>{
  const test:Expression={kind:'property',object:ident('gui'),name:'done'};
  const condition:Expression=captured ? {kind:'call',callee:{kind:'function-expr',params:[],isVararg:false,
    body:block([{kind:'return',values:[test]}])},args:[],open:false} : test;
  const result=inferHumanNames(chunk([{kind:'repeat',body:block([local('gui',call('fetch')),
    local('panel',{kind:'method-call',object:ident('gui'),name:'method',args:[],open:false})]),test:condition}]));
  expect(analyzeBindings(result.body).globals.has('gui')).toBe(false);
  expect(printLuau(result)).toContain('local gui = fetch()');
});
it.each([false,true])('retains a table read by a repeat condition (closure: %s)',captured=>{
  const test:Expression={kind:'property',object:ident('Nukes'),name:'done'};
  const condition:Expression=captured ? {kind:'call',callee:{kind:'function-expr',params:[],isVararg:false,
    body:block([{kind:'return',values:[test]}])},args:[],open:false} : test;
  const result=inferHumanNames(chunk([{kind:'repeat',body:block([local('folder',call('fetch')),
    local('Nukes',child()),parent()]),test:condition}]));
  expect(analyzeBindings(result.body).globals.has('Nukes')).toBe(false);
  expect(printLuau(result)).toContain('local Nukes');
});
