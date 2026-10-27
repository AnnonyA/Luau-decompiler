import {expect,it} from 'vitest';
import {chunk,block,ident,lit} from '../src/ast/Ast.ts';
import {inferHumanNames} from '../src/reconstruct/NameInference.ts';
import {analyzeBindings} from '../src/analysis/Bindings.ts';

it('preserves public declaration path segments even when a local shares their spelling',()=>{
 const ast=chunk([
  {kind:'local',names:['value'],values:[{kind:'table',fields:[]}]},
  {kind:'local',names:['result'],values:[{kind:'call',callee:ident('getScore'),args:[],open:false}]},
  {kind:'function-decl',name:'value.result',local:false,params:[],isVararg:false,body:block([{kind:'return',values:[ident('result')]}])},
 ]);
 const renamed=inferHumanNames(ast);
 const fn=renamed.body.statements.find(s=>s.kind==='function-decl');
 expect(fn?.kind==='function-decl'&&fn.name.split('.')[1]).toBe('result');
});
it('resolves the repeat condition in the body local scope',()=>{
 const ast=chunk([{kind:'repeat',body:block([{kind:'local',names:['value'],values:[{kind:'call',callee:ident('getSession'),args:[],open:false}]}]),test:{kind:'binary',op:'==',left:ident('value'),right:lit(2)}}]);
 expect([...analyzeBindings(inferHumanNames(ast).body).globals]).toEqual(['getSession']);
});
