import {expect,it} from 'vitest';
import {block,chunk,ident,lit,type Expression,type Statement} from '../src/ast/Ast.ts';
import {inferHumanNames} from '../src/reconstruct/NameInference.ts';
import {printLuau} from '../src/print/LuauPrinter.ts';
import {analyzeBindings} from '../src/analysis/Bindings.ts';
const property=(object:string,name:string):Expression=>({kind:'property',object:ident(object),name});
const fallback=(value:Expression,defaultValue:Expression=lit(0)):Expression=>({kind:'binary',op:'or',left:value,right:defaultValue});
const guarded=(name:string,object='rarity',guard=object):Expression=>({kind:'binary',op:'and',left:ident(guard),right:property(object,name)});
const use:Statement={kind:'expression-stmt',expression:{kind:'call',callee:ident('observe'),args:[ident('result')],open:false}};
const source=(value:Expression)=>printLuau(inferHumanNames(chunk([{kind:'local',names:['result'],values:[value]},use])));
it('uses the field role of a nullable property lookup with a literal default',()=>{
  expect(source(fallback(guarded('Order')))).toBe('local order = rarity and rarity.Order or 0\nobserve(order)\n');
});
it('uses direct field roles with false, nil and string defaults',()=>{
  for(const value of [lit(false),lit(null),lit('unknown')]) {
    expect(source(fallback(property('record','Status'),value))).toContain('local status = record.Status or');
    expect(source(fallback(property('record','Status'),value))).toContain('observe(status)');
  }
});
it('does not pick one field when the guard or fallback provides conflicting evidence',()=>{
  expect(source(fallback(guarded('Order','other','rarity')))).toContain('local result =');
  expect(source(fallback(property('record','Status'),property('other','Value')))).toContain('local result =');
});
it('keeps field hints distinct from free globals and explicit function names',()=>{
  const fn:Statement={kind:'function-decl',local:true,name:'order2',params:[],isVararg:false,body:block([])};
  const ast=chunk([{kind:'local',names:['result'],values:[fallback(guarded('Order'))]},fn,use,
    {kind:'return',values:[ident('order'),ident('order2')]}]);
  const result=inferHumanNames(ast),text=printLuau(result);
  expect(text).toContain('local order3 =');expect(text).toContain('observe(order3)');
  expect(text).toContain('local function order2()');expect(text).toContain('return order, order2');
  expect(analyzeBindings(result.body).globals).toEqual(new Set(['rarity','observe','order']));
});
it('does not rename a function from a later fallback assignment to its binding',()=>{
  const ast=chunk([
    {kind:'function-decl',local:true,name:'result',params:[],isVararg:false,body:block([])},use,
    {kind:'assign',targets:[ident('result')],values:[fallback(property('record','Status'))]},
    {kind:'return',values:[ident('result')]},
  ]);
  const source=printLuau(inferHumanNames(ast));
  expect(source).toContain('local function result()');
  expect(source).toContain('observe(result)');
  expect(source).toContain('result = record.Status or 0');
  expect(source).toContain('return result');
});
