import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {block,chunk,ident,lit,type Expression,type Statement} from '../src/ast/Ast.ts';
import {decompile} from '../src/decompile.ts';
import {recoverInlineCalls} from '../src/reconstruct/InlineRecovery.ts';
const field=(name:string,key:string):Expression=>({kind:'property',object:ident(name),name:key});
const formula=(name:string):Expression=>({kind:'binary',op:'+',left:{kind:'binary',op:'*',left:ident(name),right:lit(3)},right:lit(1)});
const store=(object:string,key:string,value:Expression):Statement=>({kind:'assign',targets:[field(object,key)],values:[value]});
function body(object:string,value:string):Statement[]{return [store(object,'score',formula(value)),store(object,'tag',lit(7))];}
function helper():Extract<Statement,{kind:'function-decl'}>{return {kind:'function-decl',local:true,name:'record',params:['state','value'],isVararg:false,line:1,body:block(body('state','value'))};}
const table=():Statement=>({kind:'local',names:['state'],values:[{kind:'table',fields:[]}]});
const loop=(statements:Statement[]):Statement=>({kind:'numeric-for',name:'index',start:lit(-3),stop:lit(3),body:block(statements)});
const call=(name:string,args:Expression[]):Statement=>({kind:'expression-stmt',expression:{kind:'call',callee:ident(name),args,open:false}});
function run(statements:Statement[]){const input=chunk(statements),copy=structuredClone(input);const result=recoverInlineCalls(input,new Set([1,2]));expect(input).toEqual(copy);return result;}
it('recovers ordered writes to a private fresh table as a void helper call',()=>{
 const result=run([helper(),table(),loop(body('state','index'))]);
 const last=result.body.statements.at(-1)!;
 expect(last.kind==='numeric-for' && last.body.statements).toEqual([call('record',[ident('state'),ident('index')])]);
});
it('matches a helper early return to the guarded continuation emitted by O2',()=>{
 const h=helper();h.body=block([{kind:'if',test:{kind:'binary',op:'<',left:ident('value'),right:lit(0)},
  consequent:block([store('state','low',formula('value')),{kind:'return',values:[]}]),branches:[]},store('state','high',formula('value'))]);
 const branch:Statement={kind:'if',test:{kind:'binary',op:'<',left:ident('index'),right:lit(0)},
  consequent:block([store('state','low',formula('index'))]),branches:[],alternate:block([store('state','high',formula('index'))])};
 const result=run([h,table(),loop([branch])]);const last=result.body.statements.at(-1)!;
 expect(last.kind==='numeric-for' && last.body.statements).toEqual([call('record',[ident('state'),ident('index')])]);
});
it('does not assume a table from a call has no metatable',()=>{
 const declaration:Statement={kind:'local',names:['state'],values:[{kind:'call',callee:ident('setmetatable'),args:[{kind:'table',fields:[]},{kind:'table',fields:[]}],open:false}]};
 const input=[helper(),declaration,loop(body('state','index'))];expect(run(input)).toEqual(chunk(input));
});
it('rejects escaped, aliased, reassigned or closure-captured tables',()=>{
 const cases:Statement[]=[call('publish',[ident('state')]),{kind:'local',names:['alias'],values:[ident('state')]},
  {kind:'assign',targets:[ident('state')],values:[{kind:'table',fields:[]}]},
  {kind:'function-decl',local:true,name:'read',params:[],isVararg:false,body:block([{kind:'return',values:[field('state','score')]}])}];
 for(const escape of cases){const input=[helper(),table(),escape,loop(body('state','index'))];expect(run(input)).toEqual(chunk(input));}
});
it('does not erase effects or change the order of adjacent writes',()=>{
 const stores=body('state','index');
 for(const region of [[stores[0]!,call('tick',[]),stores[1]!],[...stores].reverse(),[stores[0]!]]) {
  const input=[helper(),table(),loop(region)];expect(run(input)).toEqual(chunk(input));
 }
});
it('does not consume a caller return or admit a value-returning helper',()=>{
 const h=helper();h.body.statements.push({kind:'return',values:[lit(1)]});
 const input=[h,table(),loop(body('state','index'))];expect(run(input)).toEqual(chunk(input));
 const early=helper();early.body.statements.push({kind:'return',values:[]});
 const region=[...body('state','index'),{kind:'return',values:[]} as Statement];
 const result=run([early,table(),loop(region)]);const last=result.body.statements.at(-1)!;
 expect(last.kind==='numeric-for' && last.body.statements.at(-1)).toEqual({kind:'return',values:[]});
});
it('refuses competing helpers and unknown numeric arguments',()=>{
 const rival=helper();rival.name='alternative';rival.line=2;
 const ambiguous=[helper(),rival,table(),loop(body('state','index'))];expect(run(ambiguous)).toEqual(chunk(ambiguous));
 const unknown=[helper(),table(),{kind:'local',names:['input'],values:[{kind:'vararg'}]} as Statement,...body('state','input')];expect(run(unknown)).toEqual(chunk(unknown));
});
it('compares actual field keys and refuses dynamic or invalid keys',()=>{
 const changed=[store('state','other',formula('index')),store('state','tag',lit(7))];
 const input=[helper(),table(),loop(changed)];expect(run(input)).toEqual(chunk(input));
 for(const key of [lit(NaN),ident('key')]) {
  const h=helper();h.body.statements[0]={kind:'assign',targets:[{kind:'index',table:ident('state'),key}],values:[formula('value')]};
  const input=[h,table(),loop(body('state','index'))];expect(run(input)).toEqual(chunk(input));
 }
});
it('does not recover a helper that calls code or writes a free table',()=>{
 const h=helper();h.body.statements.unshift(call('observe',[]));
 let input=[h,table(),loop([call('observe',[]),...body('state','index')])];expect(run(input)).toEqual(chunk(input));
 const captured=helper();captured.body=block(body('external','value'));
 input=[captured,table(),loop(body('state','index'))];expect(run(input)).toEqual(chunk(input));
});
it('preserves a caller early return rather than turning it into a helper return',()=>{
 const h=helper();h.body=block([{kind:'if',test:{kind:'binary',op:'<',left:ident('value'),right:lit(0)},
  consequent:block([...body('state','value'),{kind:'return',values:[]}]),branches:[]}]);
 const branch:Statement={kind:'if',test:{kind:'binary',op:'<',left:ident('index'),right:lit(0)},
  consequent:block([...body('state','index'),{kind:'return',values:[]}]),branches:[]};
 const input=[h,table(),loop([branch])];expect(run(input)).toEqual(chunk(input));
});
it('recovers official O2 table helpers while retaining unsafe writes in the caller',()=>{
 const run=(name:string,recoverInlinedFunctions=true)=>{
  const bytes=readFileSync(new URL(`./fixtures/object-optimized/${name}-O2.luauc`,import.meta.url));
  const result=decompile(bytes,{opcodeEncoding:'official',recoverInlinedFunctions});
  expect(result.ok).toBe(true);if(!result.ok)throw Error(result.error);
  expect(result.validation).toEqual([]);return result.source;
 };
 expect(run('inlined-table-updates')).toMatch(/record\(config, i\)/);
 expect(run('inlined-table-write-branches')).toMatch(/classify\(j, config\)/);
 expect(run('inlined-table-updates',false)).not.toMatch(/record\(config, i\)/);
 // Metatable callbacks, frozen writes and observable alias identity must not
 // acquire a new helper frame. Exclude the retained helper declaration itself.
 expect(run('inlined-table-write-effects').replace(/local function record\([^\n]*/,''))
  .not.toMatch(/\brecord\(/);
});
it('does not move an initializer rewrite into a scope that shadows its helper',()=>{
 const scalar:Statement={kind:'function-decl',local:true,name:'weighted',params:['value'],isVararg:false,
  line:1,body:block([{kind:'return',values:[formula('value')]}])};
 const record=helper();record.line=2;
 record.body=block([store('state','score',{kind:'binary',op:'*',left:ident('value'),right:lit(9)}),store('state','tag',lit(7))]);
 const result=run([scalar,record,{kind:'local',names:['x'],values:[lit(2)]},
  {kind:'local',names:['z'],values:[{kind:'binary',op:'*',left:formula('x'),right:lit(9)}]},
  {kind:'local',names:['weighted'],values:[lit(0)]},table(),
  store('state','score',ident('z')),store('state','tag',lit(7))]);
 // z can call the original helper, but the newly extracted argument must stay
 // arithmetic: applying z's old-site rewrite here would call the number zero.
 expect(result.body.statements[3]).toEqual({kind:'local',names:['z'],values:[{kind:'binary',op:'*',
  left:{kind:'call',callee:ident('weighted'),args:[ident('x')],open:false},right:lit(9)}]});
 expect(result.body.statements.at(-1)).toEqual(call('record',[ident('state'),formula('x')]));
});
