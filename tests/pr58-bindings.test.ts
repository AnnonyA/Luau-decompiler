import {describe,it,expect} from 'vitest';
import {chunk,block,ident,lit,type Statement,type Expression} from '../src/ast/Ast.ts';
import {cleanupAst} from '../src/ast/AstCleanup.ts';
import {printLuau} from '../src/print/LuauPrinter.ts';
const clean=(statements:Statement[])=>printLuau(cleanupAst(chunk(statements),{typeAnnotations:'off',ifExpressions:false,earlyReturn:false,interpolatedStrings:false,mathConstants:false}));
const table=(value:Expression):Expression=>({kind:'table',fields:[{name:'x',value}]});
const call=(callee:string,...args:Expression[]):Expression=>({kind:'call',callee:ident(callee),args,open:false});
describe('table ownership and lexical dependencies',()=>{
 it('substitutes a one-use table in a generic iterator without deleting its only definition',()=>{
  const source=clean([{kind:'local',names:['config'],values:[table(lit(3))]},
   {kind:'generic-for',names:['k','v'],iterators:[call('pairs',ident('config'))],body:block([{kind:'expression-stmt',expression:call('print',ident('v'))}])}]);
  expect(source).toMatch(/pairs\(\{\s*x = 3/);
 });
 it('takes a snapshot of dependencies before subsequent writes',()=>{
  const source=clean([{kind:'local',names:['n'],values:[lit(1)]},{kind:'local',names:['config'],values:[table(ident('n'))]},
   {kind:'assign',targets:[ident('n')],values:[lit(2)]},{kind:'return',values:[ident('config')]}]);
  expect(source.indexOf('x = n')).toBeLessThan(source.indexOf('n = 2'));
 });
 it('retains one table identity across repeated closure calls',()=>{
  const source=clean([{kind:'local',names:['config'],values:[table(lit(3))]},
   {kind:'return',values:[{kind:'function-expr',params:[],isVararg:false,body:block([{kind:'return',values:[ident('config')]}])}]}]);
  expect(source).toMatch(/local config =/);
 });
 it('does not substitute references belonging to a shadowing parameter',()=>{
  const source=clean([{kind:'local',names:['config'],values:[table(lit(3))]},
   {kind:'function-decl',local:true,name:'echo',params:['config'],isVararg:false,body:block([{kind:'return',values:[ident('config')]}])},
   {kind:'return',values:[ident('config'),call('echo',lit(9))]}]);
  expect(source).toMatch(/return config\d*\n/);
  expect(source).toMatch(/x = 3/);
 });
});
it('keeps a referenced underscore local instead of changing it into a global read',()=>{
 const source=clean([{kind:'local',names:['_'],values:[lit(null)]},{kind:'return',values:[ident('_')]}]);
 expect(source).toContain('local _');
});
it('keeps nil bindings written by a closure even when a parameter shadows their name',()=>{
 const source=clean([{kind:'local',names:['saved'],values:[]},
  {kind:'function-decl',local:true,name:'set',params:['value'],isVararg:false,body:block([{kind:'assign',targets:[ident('saved')],values:[ident('value')]}])},
  {kind:'return',values:[ident('set')]}]);
 expect(source).toContain('local saved');
});
