import {expect,it} from 'vitest';
import {block,chunk,ident,lit,type Statement} from '../src/ast/Ast.ts';
import {boundLocalLifetimes} from '../src/reconstruct/LocalLifetimes.ts';
import {analyzeBindings} from '../src/analysis/Bindings.ts';
function many(prefix:Statement[]=[]){return chunk([...prefix,...Array.from({length:220},(_,i)=>[
 {kind:'local',names:['value'+i],values:[{kind:'call',callee:ident('effect'),args:[lit(i)],open:false}]} as Statement,
 {kind:'expression-stmt',expression:{kind:'call',callee:ident('observe'),args:[ident('value'+i)],open:false}} as Statement,
]).flat()]);}
it('ends temporary scopes after their final use without losing effect order',()=>{
 const original=many();const result=boundLocalLifetimes(original);
 expect(result.body.statements.filter(s=>s.kind==='do')).toHaveLength(219); // the final lifetime needs no additional scope
 expect(result.body.statements.flatMap(s=>s.kind==='do'?s.body.statements:[s])).toEqual(original.body.statements);
 expect([...analyzeBindings(result.body).globals].sort()).toEqual(['effect','observe']);
});
it('keeps a cell visible through nested closures, later writes, and dependent locals',()=>{
 const input=many([{kind:'local',names:['state'],values:[lit(0)]}]);
 input.body.statements.push({kind:'function-decl',local:true,name:'reader',params:[],isVararg:false,body:block([{kind:'return',values:[ident('state')]}])},
 {kind:'assign',targets:[ident('state')],values:[lit(4)]},{kind:'return',values:[ident('reader')]});
 const result=boundLocalLifetimes(input),binding=analyzeBindings(result.body).bindings.find(b=>b.name==='state')!;
 expect(binding.scope).toBe(result.body);expect(binding.captured).toBe(true);expect(binding.writes).toHaveLength(1);
 expect(result.body.statements.filter(s=>s.kind==='do')).toHaveLength(220); // the returned reader stays in the final lexical region
 expect([...analyzeBindings(result.body).globals].sort()).toEqual(['effect','observe']);
});
it('does not hide a repeat-body local from its until condition',()=>{
 const body=many().body;body.statements.push({kind:'local',names:['done'],values:[lit(true)]});
 const input=chunk([{kind:'repeat',body,test:ident('done')}]);
 const result=boundLocalLifetimes(input);
 expect(analyzeBindings(result.body).globals.has('done')).toBe(false);
});
it('commits large constructors before their field snapshots exhaust local registers',async()=>{
 const {readFileSync}=await import('node:fs');const {decompile}=await import('../src/decompile.ts');
 const result=decompile(readFileSync(new URL('./fixtures/object-optimized/bounded-constructor-lifetimes-O1.luauc',import.meta.url)),{opcodeEncoding:'official'});
 expect(result.ok).toBe(true);if(!result.ok)throw Error(result.error);
 expect(result.validation).toEqual([]);
 expect(result.ast.body.statements.some(s=>s.kind==='do')).toBe(true);
 const top=analyzeBindings(result.ast.body).bindings.filter(b=>b.scope===result.ast.body);
 expect(top.length).toBeLessThan(128);
});
it('folds an ordered, single-use argument chain without retaining hundreds of locals',()=>{
 const input=chunk([
  {kind:'local',names:['sink'],values:[ident('observe')]},
  ...Array.from({length:130},(_,i)=>({kind:'local',names:['v'+i],values:[{kind:'call',callee:ident('effect'),args:[lit(i)],open:false}]} as Statement)),
  {kind:'expression-stmt',expression:{kind:'call',callee:ident('sink'),args:Array.from({length:130},(_,i)=>ident('v'+i)),open:false}},
 ]);
 const output=boundLocalLifetimes(input);
 expect(analyzeBindings(output.body).bindings).toHaveLength(0);
 const call=output.body.statements.at(-1)!;
 if(call.kind!=='expression-stmt'||call.expression.kind!=='call')throw Error('missing sink');
 expect(call.expression.args).toHaveLength(130);
 expect(call.expression.args.at(-1)?.kind).toBe('paren'); // fixed result, even in the final argument
});
it.each(['global','effectful-prefix','mutable-callee'])('keeps argument timing when the %s is observable',mode=>{
 const input=chunk([
  ...(mode==='global'?[]:[{kind:'local',names:['sink'],values:[ident('observe')]} as Statement]),
  ...Array.from({length:130},(_,i)=>({kind:'local',names:['v'+i],values:[{kind:'call',callee:ident('effect'),args:[lit(i)],open:false}]} as Statement)),
  {kind:'expression-stmt',expression:{kind:'call',callee:ident(mode==='global'?'observe':'sink'),args:[
   ...(mode==='effectful-prefix'?[{kind:'call',callee:ident('prefix'),args:[],open:false} as const]:[]),
   ...Array.from({length:130},(_,i)=>ident('v'+i))],open:false}},
  ...(mode==='mutable-callee'?[{kind:'assign',targets:[ident('sink')],values:[ident('replacement')]} as Statement]:[]),
 ]);
 const output=boundLocalLifetimes(input);
 expect(analyzeBindings(output.body).bindings.length).toBeGreaterThanOrEqual(130);
});
