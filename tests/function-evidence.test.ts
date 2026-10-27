import {expect,it} from 'vitest';
import {block,chunk,ident,lit,type Statement,type Expression} from '../src/ast/Ast.ts';
import {recoverFunctionEvidence} from '../src/reconstruct/FunctionEvidence.ts';
import {printLuau} from '../src/print/LuauPrinter.ts';
const call=(name:string,...args:Expression[]):Expression=>({kind:'call',callee:ident(name),args,open:false});
const fn=(body:Statement[],params=['arg']):Statement=>({kind:'function-decl',local:true,name:'transform',params,isVararg:false,body:block(body)});
it('propagates stable caller names and primitive types through a local function',()=>{
 const ast=chunk([{kind:'local',names:['score'],values:[lit(8)]},fn([{kind:'return',values:[ident('arg')]}]),{kind:'return',values:[call('transform',ident('score'))]}]);
 const source=printLuau(recoverFunctionEvidence(ast));
 expect(source).toContain('transform(score2: number): number');
 expect(source).toContain('return score2');
 expect(printLuau(ast)).toContain('transform(arg)');
});
it('does not infer parameters from an incomplete set of calls when the function escapes',()=>{
 const ast=chunk([fn([{kind:'return',values:[ident('arg')]}]),{kind:'expression-stmt',expression:call('transform',lit(8))},{kind:'return',values:[ident('transform')]}]);
 expect(printLuau(recoverFunctionEvidence(ast))).toContain('transform(arg)\n');
});
it('joins conflicting observed primitive inputs instead of choosing one',()=>{
 const ast=chunk([fn([{kind:'return',values:[ident('arg')]}]),{kind:'expression-stmt',expression:call('transform',lit(8))},{kind:'return',values:[call('transform',lit('a'))]}]);
 expect(printLuau(recoverFunctionEvidence(ast))).toContain('arg: number | string');
});
it('does not assign a narrow type to mutable captured parameters',()=>{
 const ast=chunk([fn([{kind:'local',names:['change'],values:[{kind:'function-expr',params:[],isVararg:false,body:block([{kind:'assign',targets:[ident('arg')],values:[lit('changed')]}])}]},{kind:'return',values:[ident('arg'),ident('change')]}]),{kind:'return',values:[call('transform',lit(8))]}]);
 expect(printLuau(recoverFunctionEvidence(ast))).not.toContain('arg: number');
});
it('infers fixed multiple returns but leaves open packs and fallthrough unknown',()=>{
 const ast=chunk([fn([{kind:'return',values:[lit(1),lit(null),lit('x')]}],[]),{kind:'return',values:[call('transform')]}]);
 expect(printLuau(recoverFunctionEvidence(ast))).toContain('(): (number, nil, string)');
 const unknown=chunk([fn([{kind:'if',test:ident('arg'),consequent:block([{kind:'return',values:[lit(1)]}]),branches:[]}]),{kind:'return',values:[call('transform',lit(true))]}]);
 expect(printLuau(recoverFunctionEvidence(unknown))).not.toContain('): number');
});
it('uses method usage as naming evidence without renaming public methods',()=>{
 const ast=chunk([fn([{kind:'expression-stmt',expression:{kind:'method-call',object:ident('arg'),name:'Disconnect',args:[],open:false}},{kind:'return',values:[]}]),{kind:'return',values:[ident('transform')]}]);
 expect(printLuau(recoverFunctionEvidence(ast,{typeAnnotations:'off'}))).toContain('connection:Disconnect()');
});
it('off mode emits no added types and preserves free globals during renaming',()=>{
 const ast=chunk([{kind:'local',names:['score'],values:[lit(8)]},fn([{kind:'return',values:[ident('arg'),ident('score2')]}]),{kind:'return',values:[call('transform',ident('score'))]}]);
 const source=printLuau(recoverFunctionEvidence(ast,{typeAnnotations:'off'}));
 expect(source).toContain('transform(score3)');
 expect(source).toContain('return score3, score2');
});
