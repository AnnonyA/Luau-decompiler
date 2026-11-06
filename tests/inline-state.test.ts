import {expect,it} from 'vitest';
import {block,chunk,ident,lit,type Expression,type Statement} from '../src/ast/Ast.ts';
import {recoverInlineCalls} from '../src/reconstruct/InlineRecovery.ts';
import {readFileSync} from 'node:fs';
import {decompile} from '../src/decompile.ts';
import {analyzeBindings} from '../src/analysis/Bindings.ts';
import {abc,ad,compile,proto,Opcode,CaptureType} from './helpers.ts';

const add=(left:Expression,right:Expression):Expression=>({kind:'binary',op:'+',left,right});
const set=(name:string,value:Expression):Statement=>({kind:'assign',targets:[ident(name)],values:[value]});
const increment=(name:string):Statement=>({kind:'compound-assign',target:ident(name),op:'+',value:lit(1)});
const local=(name:string,value:Expression):Statement=>({kind:'local',names:[name],values:[value]});
const call=(name:string,args:Expression[]):Statement=>({kind:'expression-stmt',expression:{kind:'call',callee:ident(name),args,open:false}});
function region(value:string,compound=false):Statement[]{return [
 compound?increment('count'):set('count',add(ident('count'),lit(1))),
 {kind:'if',test:{kind:'binary',op:'>',left:ident(value),right:lit(0)},
  consequent:block([set('total',add(ident('total'),ident('count')))]),branches:[],
  alternate:block([set('total',add(ident('total'),lit(-1)))])},
];}
function helper():Extract<Statement,{kind:'function-decl'}>{return {kind:'function-decl',local:true,name:'advance',
 params:['value'],isVararg:false,line:1,body:block(region('value',true))};}
function program(extra:Statement[]=[]):Statement[]{return [local('count',lit(0)),local('total',lit(10)),helper(),...extra,
 {kind:'numeric-for',name:'i',start:lit(-2),stop:lit(3),body:block(region('i'))}];}
function run(input:Statement[]){const ast=chunk(input),copy=structuredClone(ast);const output=recoverInlineCalls(ast,new Set([1]));expect(ast).toEqual(copy);return output;}
it('recovers ordered updates of numeric captured cells, including compound stores',()=>{
 const result=run(program());const loop=result.body.statements.at(-1)!;
 expect(loop.kind==='numeric-for' && loop.body.statements).toEqual([call('advance',[ident('i')])]);
});
it('refuses state that any other closure can replace with an unknown value',()=>{
 const setter:Statement={kind:'function-decl',local:true,name:'replace',params:['unknown'],isVararg:false,
  body:block([set('count',ident('unknown'))])};
 const input=program([setter]);expect(run(input)).toEqual(chunk(input));
});
it('does not confuse shadowed cells, snapshots or parameter writes with captures',()=>{
 const input=program();const loop=input.at(-1)!;if(loop.kind!=='numeric-for')throw Error();
 loop.body.statements.unshift(local('count',lit(20)));expect(run(input)).toEqual(chunk(input));
 const h=helper();h.body.statements.unshift(set('value',add(ident('value'),lit(1))));
 const reassigned=program();reassigned[2]=h;expect(run(reassigned)).toEqual(chunk(reassigned));
});
it('does not remove intervening effects or recover an argument changed by the region',()=>{
 const input=program();const loop=input.at(-1)!;if(loop.kind!=='numeric-for')throw Error();
 loop.body.statements.splice(1,0,call('observe',[ident('count')]));expect(run(input)).toEqual(chunk(input));
 const changed=program();const last=changed.at(-1)!;if(last.kind!=='numeric-for')throw Error();
 last.body=block(region('count'));expect(run(changed)).toEqual(chunk(changed));
});
it('recovers a once-initialized forward local function, but never a reassigned one',()=>{
 const input=program(),h=helper();
 const fn:Expression={kind:'function-expr',params:h.params,isVararg:false,body:h.body,line:1};
 input.splice(2,1,{kind:'local',names:['advance'],values:[]},set('advance',fn));
 const result=run(input),loop=result.body.statements.at(-1)!;
 expect(loop.kind==='numeric-for' && loop.body.statements).toEqual([call('advance',[ident('i')])]);
 input.push(set('advance',lit(0)));expect(run(input)).toEqual(chunk(input));
});
it('recovers a no-argument state helper without consuming the following caller return',()=>{
 const h=helper();h.params=[];h.body=block([increment('count'),increment('total')]);
 const input=[local('count',lit(0)),local('total',lit(10)),h,increment('count'),increment('total'),{kind:'return',values:[ident('total')]} as Statement];
 const result=run(input);
 expect(result.body.statements.slice(-2)).toEqual([call('advance',[]),{kind:'return',values:[ident('total')]}]);
});
it('recovers real O2 state helpers with unused reconstruction snapshots',()=>{
 for(const [name,expected] of [['inlined-captured-counter',/advance\(index\)/],['inlined-captured-table',/record\(config, i\)/]] as const){
  const bytes=readFileSync(new URL(`./fixtures/object-optimized/${name}-O2.luauc`,import.meta.url));
  const result=decompile(bytes,{opcodeEncoding:'official'});
  expect(result.ok).toBe(true);if(!result.ok)throw Error(result.error);
  expect(result.validation).toEqual([]);expect(result.source).toMatch(expected);
 }
});
it('invalidates numeric dependencies transitively, including cycles with an unknown writer',()=>{
 const input=program([set('count',ident('total')),set('total',ident('count'))]);
 input.push({kind:'function-decl',local:true,name:'poison',params:['unknown'],isVararg:false,body:block([set('total',ident('unknown'))])});
 expect(run(input)).toEqual(chunk(input));
});
it('requires initialized numeric cells and rejects parallel or metamethod-capable writers',()=>{
 for(const bad of [
  {kind:'local',names:['count'],values:[]} as Statement,
  local('count',{kind:'call',callee:ident('makeNumber'),args:[],open:false}),
 ]) {const input=program();input[0]=bad;expect(run(input)).toEqual(chunk(input));}
 const parallel=program([{kind:'assign',targets:[ident('count'),ident('total')],values:[lit(1),lit(2)]}]);
 expect(run(parallel)).toEqual(chunk(parallel));
 const metamethod=program([{kind:'function-decl',local:true,name:'addUnknown',params:['unknown'],isVararg:false,
  body:block([set('count',add(ident('count'),ident('unknown')))])}]);
 expect(run(metamethod)).toEqual(chunk(metamethod));
});
it('keeps used snapshots and does not discard effectful unused initializers',()=>{
 const input=program();const loop=input.at(-1)!;if(loop.kind!=='numeric-for')throw Error();
 loop.body.statements.splice(1,0,local('unused',{kind:'call',callee:ident('observe'),args:[ident('count')],open:false}));
 expect(run(input)).toEqual(chunk(input));
 const saved=program();const last=saved.at(-1)!;if(last.kind!=='numeric-for')throw Error();
 last.body=block([local('saved',ident('count')),...region('saved')]);
 expect(run(saved)).toEqual(chunk(saved));
});
it('keeps callee initialization inside its branch and ignores a shadowing forward local',()=>{
 const input=program(),h=helper();
 const fn:Expression={kind:'function-expr',params:h.params,isVararg:false,body:h.body,line:1};
 input.splice(2,1,{kind:'local',names:['advance'],values:[]},
  {kind:'if',test:ident('condition'),consequent:block([set('advance',fn)]),branches:[]});
 expect(run(input)).toEqual(chunk(input));
});
it.each([['inlined-captured-counter',2],['inlined-captured-join',3]] as const)('keeps intermediate O2 writes on the original REF cell in %s',(name,writes)=>{
 const bytes=readFileSync(new URL(`./fixtures/object-optimized/${name}-O2.luauc`,import.meta.url));
 const result=decompile(bytes,{opcodeEncoding:'official',recoverInlinedFunctions:false});
 expect(result.ok).toBe(true);if(!result.ok)throw Error(result.error);
 const loop=result.ast.body.statements.find(s=>s.kind==='numeric-for');
 if(loop?.kind!=='numeric-for')throw Error('missing loop');
 const count=analyzeBindings(result.ast.body).bindings.find(b=>b.scope===result.ast.body && b.captured &&
  b.declaration.kind==='local' && b.declaration.values[b.declarationIndex!]?.kind==='literal' &&
  (b.declaration.values[b.declarationIndex!] as {value:unknown}).value===0);
 expect(count).toBeDefined();
 // The join fixture also writes the result of its conditional expression;
 // the two subsequent updates must retain that same cell as well.
 expect(count!.writes.filter(w=>w.scope===loop.body)).toHaveLength(writes);
});
it('does not resurrect a captured cell closed on both paths before a join',()=>{
 const bytes=compile(proto({maxStackSize:4,isVararg:true,
  constants:[{kind:'number',value:1},{kind:'number',value:2},{kind:'number',value:3}],
  children:[proto({maxStackSize:1,numUpvalues:1,instructions:[abc(Opcode.GETUPVAL,0,0),abc(Opcode.RETURN,0,2)]})],
  instructions:[abc(Opcode.PREPVARARGS,0),ad(Opcode.LOADN,0,0),ad(Opcode.NEWCLOSURE,1,0),abc(Opcode.CAPTURE,CaptureType.REF,0),
   abc(Opcode.GETVARARGS,2,2),ad(Opcode.JUMPIFNOT,2,5),abc(Opcode.MOVE,3,1),abc(Opcode.CALL,3,1,1),
   abc(Opcode.ADDK,0,0,0),abc(Opcode.CLOSEUPVALS,0),ad(Opcode.JUMP,0,4),abc(Opcode.MOVE,3,1),abc(Opcode.CALL,3,1,1),
   abc(Opcode.ADDK,0,0,1),abc(Opcode.CLOSEUPVALS,0),abc(Opcode.ADDK,0,0,2),abc(Opcode.MOVE,2,1),abc(Opcode.CALL,2,1,2),abc(Opcode.RETURN,2,2)]}));
 const result=decompile(bytes,{recoverInlinedFunctions:false});
 expect(result.ok).toBe(true);if(!result.ok)throw Error(result.error);
 const count=analyzeBindings(result.ast.body).bindings.find(b=>b.scope===result.ast.body && b.captured && b.declaration.kind==='local');
 expect(count).toBeDefined();
 expect(count!.writes).toHaveLength(2);
 expect(count!.writes.filter(w=>w.scope===result.ast.body)).toHaveLength(0);
});
it('preserves the old value copied before either branch mutates a captured cell',()=>{
 const bytes=readFileSync(new URL('./fixtures/object-optimized/captured-branch-snapshot-O2.luauc',import.meta.url));
 const result=decompile(bytes,{opcodeEncoding:'official'});
 expect(result.ok).toBe(true);if(!result.ok)throw Error(result.error);
 const fn=result.ast.body.statements.find(s=>s.kind==='function-decl' && s.name==='scenario');
 if(fn?.kind!=='function-decl')throw Error('missing scenario');
 const ret=fn.body.statements.at(-1)!;if(ret.kind!=='return')throw Error('missing return');
 const bindings=analyzeBindings(result.ast.body).bindings;
 const owner=(e:Expression)=>bindings.find(b=>b.reads.some(r=>r.node===e));
 expect(owner(ret.values[0]!)).toBeDefined();expect(owner(ret.values[1]!)).toBeDefined();
 expect(owner(ret.values[0]!)).not.toBe(owner(ret.values[1]!));
 expect(owner(ret.values[0]!)!.writes).toHaveLength(0);
});
