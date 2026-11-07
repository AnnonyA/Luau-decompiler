import {expect,it} from 'vitest';
import {block,chunk,ident,lit,type Expression,type Statement} from '../src/ast/Ast.ts';
import {recoverInlineCalls} from '../src/reconstruct/InlineRecovery.ts';
import {analyzeBindings} from '../src/analysis/Bindings.ts';
import {boundLocalLifetimes} from '../src/reconstruct/LocalLifetimes.ts';
import {printLuau} from '../src/print/LuauPrinter.ts';
const formula=(x:Expression):Expression=>({kind:'binary',op:'+',left:{kind:'binary',op:'*',left:x,right:lit(7)},right:lit(3)});
const square=(x:Expression):Expression=>({kind:'binary',op:'-',left:{kind:'binary',op:'*',left:x,right:x},right:lit(5)});
const helper=(name='measure'):Statement=>({kind:'function-decl',local:true,name,line:42,params:['x'],isVararg:false,
 body:block([{kind:'return',values:[formula(ident('x')),square(ident('x'))]}])});
const local=(name:string,value:Expression):Statement=>({kind:'local',names:[name],values:[value]});
function run(statements:Statement[],extra:Statement[]=[]){
 const input=chunk([helper(),...extra,{kind:'numeric-for',name:'index',start:lit(-4),stop:lit(6),body:block(statements)}]);
 const before=structuredClone(input),out=recoverInlineCalls(input,new Set([42]));expect(input).toEqual(before);return printLuau(out);
}
it('recovers a complete ordered fixed tuple into one helper call',()=>{
 const out=run([local('a',formula(ident('index'))),local('b',square(ident('index'))),{kind:'return',values:[ident('a'),ident('b')]}]);
 expect(out).toContain('local a, b = measure(index)');
});
it('retains the lexical owner of mixed local and existing-cell destinations',()=>{
 const out=run([local('a',formula(ident('index'))),{kind:'assign',targets:[ident('saved')],values:[square(ident('index'))]},
 {kind:'return',values:[ident('a'),ident('saved')]}],[local('saved',lit(0))]);
 expect(out).toMatch(/local a, \w+ = measure\(index\)/);expect(out).toMatch(/saved = \w+/);
 expect(out).not.toMatch(/local a, saved/);
});
it.each(['clipped','swapped','effects','global','mixed-arguments','ambiguous','shadow'])('rejects unsafe or ambiguous tuple recovery: %s',kind=>{
 let statements:Statement[]=[local('a',formula(ident('index'))),local('b',square(ident('index')))];
 const extra:Statement[]=[];
 if(kind==='clipped')statements.pop();
 if(kind==='swapped')statements.reverse();
 if(kind==='effects')statements.splice(1,0,{kind:'expression-stmt',expression:{kind:'call',callee:ident('observe'),args:[],open:false}});
 if(kind==='global')statements[1]={kind:'assign',targets:[ident('globalResult')],values:[square(ident('index'))]};
 if(kind==='mixed-arguments')statements[1]=local('b',square({kind:'binary',op:'+',left:ident('index'),right:lit(1)}));
 if(kind==='ambiguous')extra.push(helper('other'));
 if(kind==='shadow')statements.unshift(local('measure',lit(0)));
 expect(run(statements,extra)).not.toContain('= measure(index)');
});
it('writes an existing fixed tuple directly without allocating per-call temporaries',()=>{
 const out=run([
  {kind:'assign',targets:[ident('a')],values:[formula(ident('index'))]},
  {kind:'assign',targets:[ident('b')],values:[square(ident('index'))]},
  {kind:'return',values:[ident('a'),ident('b')]},
 ],[local('a',lit(0)),local('b',lit(0))]);
 expect(out).toContain('a, b = measure(index)');expect(out).not.toContain('inlineResult');
});

it('bounds mixed tuple temporaries even inside repeat scopes that cannot be closed early',()=>{
 const body:Statement[]=[];
 for(let i=0;i<105;i++)body.push(local('a'+i,formula(ident('index'))),
  {kind:'assign',targets:[ident('saved')],values:[square(ident('index'))]},
  {kind:'expression-stmt',expression:{kind:'call',callee:ident('print'),args:[ident('a'+i),ident('saved')],open:false}});
 const input=chunk([helper(),local('saved',lit(0)),{kind:'numeric-for',name:'index',start:lit(1),stop:lit(3),
  body:block([{kind:'repeat',body:block(body),test:lit(true)}])}]);
 const result=boundLocalLifetimes(recoverInlineCalls(input,new Set([42])));
 expect(printLuau(result)).toContain('= measure(index)');
 expect(analyzeBindings(result.body).bindings.length).toBeLessThanOrEqual(180);
});
it('includes hidden numeric-loop control registers in tuple headroom',()=>{
 let body=block([local('a',formula(ident('index0'))),
  {kind:'assign',targets:[ident('saved')],values:[square(ident('index0'))]}]);
 for(let i=0;i<72;i++)body=block([{kind:'numeric-for',name:'index'+i,start:lit(1),stop:lit(1),body}]);
 const input=chunk([helper(),local('saved',lit(0)),...body.statements]);
 expect(printLuau(recoverInlineCalls(input,new Set([42])))).not.toContain('inlineResult');
});
