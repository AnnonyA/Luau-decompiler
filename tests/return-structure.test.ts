import {expect,it} from 'vitest';
import {block,chunk,ident,lit,type Expression,type Statement} from '../src/ast/Ast.ts';
import {cleanupAst} from '../src/ast/AstCleanup.ts';
import {defaultCleanupOptions} from '../src/decompile.ts';
import {inferHumanNames} from '../src/reconstruct/NameInference.ts';
import {printLuau} from '../src/print/LuauPrinter.ts';
import {analyzeBindings} from '../src/analysis/Bindings.ts';

const local=(name:string,value:Expression):Statement=>({kind:'local',names:[name],values:[value]});
const ret=(value:Expression):Statement=>({kind:'return',values:[value]});
const call=(name:string,args:Expression[]=[]):Expression=>({kind:'call',callee:ident(name),args,open:false});
const fn=(name:string,statements:Statement[]):Statement=>({kind:'function-decl',local:true,name,params:[],isVararg:false,body:block(statements)});
const clean=(statements:Statement[],options={})=>cleanupAst(chunk(statements),defaultCleanupOptions(options));
const choose=(a:Expression,b:Expression):Statement=>({kind:'if',test:ident('flag'),branches:[],
  consequent:block([local('result',a),ret(ident('result'))]),alternate:block([local('result2',b),ret(ident('result2'))])});

it('recovers a conditional return after branch temporaries have been folded',()=>{
  expect(printLuau(clean([choose(lit(false),lit(3))]))).toBe('return if flag then false else 3\n');
});
it('keeps branch calls scalar when recovering the final conditional return',()=>{
  expect(printLuau(clean([choose(call('left'),call('right'))]))).toBe('return if flag then (left()) else (right())\n');
});
it('applies final return recovery inside callbacks and respects its switch',()=>{
  const callback:Expression={kind:'function-expr',params:[],isVararg:false,body:block([choose(lit(1),lit(2))])};
  expect(printLuau(clean([{kind:'expression-stmt',expression:call('observe',[callback])}]))).toContain('return if flag then 1 else 2');
  expect(printLuau(clean([choose(lit(1),lit(2))],{ifExpressions:false}))).not.toContain('return if');
});
it('does not collapse open packs or erase effects in return arms',()=>{
  const arm:Statement={kind:'if',test:ident('flag'),branches:[],consequent:block([ret(call('left'))]),alternate:block([ret(call('right'))])};
  expect(printLuau(clean([arm]))).not.toContain('return if');
  const effectful=choose(lit(1),lit(2));
  if(effectful.kind==='if')effectful.consequent.statements.unshift({kind:'expression-stmt',expression:call('observe')});
  const source=printLuau(clean([effectful]));
  expect(source).toContain('observe()');expect(source).not.toContain('return if');
});
const empty:Expression={kind:'table',fields:[]};
const observe=(name:string):Statement=>({kind:'expression-stmt',expression:call('observe',[ident(name)])});
it('names an owned getter result from its function through nested branch scopes',()=>{
  const ast=chunk([fn('getNukeIds',[local('config12',empty),observe('config12'),
    {kind:'if',test:ident('flag'),branches:[],consequent:block([ret(ident('config12'))])},ret(ident('config12'))])]);
  const source=printLuau(inferHumanNames(ast));
  expect(source).toContain('local nukeIds = {}');expect(source).toContain('observe(nukeIds)');
  expect(source.match(/return nukeIds/g)).toHaveLength(2);
});
it('keeps debug names and does not derive outer bindings from nested getter returns',()=>{
  const ast=chunk([local('config1',empty),fn('getForeign',[ret(ident('config1'))]),
    fn('getItems',[local('original',empty),observe('original'),ret(ident('original'))]),observe('config1')]);
  const source=printLuau(inferHumanNames(ast));
  expect(source).toContain('local config1');expect(source).toContain('return config1');
  expect(source).toContain('local original');expect(source).not.toContain('local foreign');
});
it('allocates result hints without capturing globals or nested parameter names',()=>{
  const callback:Expression={kind:'function-expr',params:['print2'],isVararg:false,body:block([ret(ident('config1'))])};
  const ast=chunk([fn('getPrint',[local('config1',empty),{kind:'expression-stmt',expression:call('print',[callback])},ret(ident('config1'))])]);
  const result=inferHumanNames(ast),source=printLuau(result);
  expect(source).toContain('local print3 = {}');expect(source).toContain('function(print2)');
  expect(source).toContain('return print3');expect(analyzeBindings(result.body).globals).toEqual(new Set(['print']));
});
it('does not infer one getter result name for multiple return positions',()=>{
  const result=inferHumanNames(chunk([fn('getItems',[local('config1',empty),observe('config1'),{kind:'return',values:[ident('config1'),lit(1)]}])]));
  expect(printLuau(result)).toContain('local config1');
});
it('does not treat implicit nil in a multi-local declaration as a table result',()=>{
  const result=inferHumanNames(chunk([fn('getItems',[
    {kind:'local',names:['owned','value1'],values:[empty]},observe('owned'),ret(ident('value1')),
  ])]));
  expect(printLuau(result)).toContain('local owned, value1 = {}');
  expect(printLuau(result)).toContain('return value1');
});
it('reserves a later explicit function name before allocating a getter result hint',()=>{
  const ast=chunk([fn('getItems',[local('config1',empty),fn('items',[]),
    {kind:'expression-stmt',expression:call('observe',[ident('items'),ident('config1')])},ret(ident('config1'))])]);
  const source=printLuau(inferHumanNames(ast));
  expect(source).toContain('local items2 = {}');
  expect(source).toContain('local function items()');
  expect(source).toContain('observe(items, items2)');
});
it('reserves forward and expression function names even when they resemble generated names',()=>{
  const expression:Expression={kind:'function-expr',params:[],isVararg:false,body:block([])};
  const forward:Statement={kind:'function-decl',local:false,name:'value',params:[],isVararg:false,body:block([])};
  for(const declarations of [
    [{kind:'local',names:['value'],values:[]},forward],
    [local('value',expression)],
    [{kind:'local',names:['value'],values:[]},{kind:'assign',targets:[ident('value')],values:[expression]}],
  ] as Statement[][]) {
    const source=printLuau(inferHumanNames(chunk([fn('getValue',[local('config1',empty),...declarations,
      {kind:'expression-stmt',expression:call('observe',[ident('value'),ident('config1')])},ret(ident('config1'))])])));
    expect(source).toContain('local value2 = {}');
    expect(source).toContain('observe(value, value2)');
  }
});
