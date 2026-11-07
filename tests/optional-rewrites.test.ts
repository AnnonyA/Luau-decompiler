import {expect,it} from 'vitest';
import {block,chunk,ident,lit,type Expression,type Statement} from '../src/ast/Ast.ts';
import {analyzeBindings} from '../src/analysis/Bindings.ts';
import {applyOptionalRewrites} from '../src/reconstruct/OptionalRewrites.ts';

const local=(name:string,value:Expression):Statement=>({kind:'local',names:[name],values:[value]});
const update=(value:Expression,name='sum'):Statement=>({kind:'compound-assign',target:ident(name),op:'+',value});
const add=(left:Expression,right:Expression):Expression=>({kind:'binary',op:'+',left,right});
const call=(name:string):Expression=>({kind:'call',callee:ident(name),args:[],open:false});
const sequence=(values:number[],extra:Statement[]=[]):Statement[]=>[
  local('sum',lit(0)),...extra,...values.map(value=>update(lit(value))),{kind:'return',values:[ident('sum')]},
];
const fn=(name:string,body:Statement[]=[],isLocal=true):Statement=>({kind:'function-decl',local:isLocal,name,
  params:[],isVararg:false,body:block(body)});
function rewrite(statements:Statement[],options:Parameters<typeof applyOptionalRewrites>[1]) {
  const input=chunk(statements),before=structuredClone(input);
  const result=applyOptionalRewrites(input,options);
  expect(input).toEqual(before);expect(result).not.toBe(input);
  return result;
}

it('leaves optional rewrites disabled and dead functions retained by default',()=>{
  const statements=[fn('unused'),...sequence([1,2,3]),{kind:'return',values:[lit(Math.PI),lit(Math.PI)]} as Statement];
  expect(rewrite(statements,{})).toEqual(chunk(statements));
});
it('rerolls unit-stride updates without reordering the expression tree',()=>{
  const statements=[local('sum',lit(0)),...[1,2,3,4].map(n=>update(add(lit(7),add(lit(n),lit(n))))),
    {kind:'return',values:[ident('sum')]} as Statement];
  const result=rewrite(statements,{rerollUnrolledLoops:true});
  const loop=result.body.statements[1];expect(loop?.kind).toBe('numeric-for');
  if(loop?.kind!=='numeric-for')throw Error('missing recovered loop');
  expect(loop.start).toEqual(lit(1));expect(loop.stop).toEqual(lit(4));
  expect(loop.body.statements).toEqual([update(add(lit(7),add(ident(loop.name),ident(loop.name))))]);
  expect(result.body.statements.at(-1)).toEqual({kind:'return',values:[ident('sum')]});
});
it('rerolls decreasing integer sequences and reserves all lexical and global names',()=>{
  const statements=sequence([3,2,1],[local('i',lit(20)),{kind:'expression-stmt',expression:ident('i_2')}]);
  const result=rewrite(statements,{rerollUnrolledLoops:true});
  const loop=result.body.statements.find(s=>s.kind==='numeric-for');
  expect(loop?.kind).toBe('numeric-for');if(loop?.kind!=='numeric-for')throw Error();
  expect(loop.step).toEqual(lit(-1));expect(loop.name).not.toBe('i');expect(loop.name).not.toBe('i_2');
  expect(analyzeBindings(result.body).globals).toEqual(new Set(['i_2']));
});
it.each([[1,2],[1,2,4],[1,3,5],[0.5,1.5,2.5],[-0,1,2],[Infinity,Infinity,Infinity],
  [Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER+1,Number.MAX_SAFE_INTEGER+2]])('keeps unproven bounds %j',(...values:number[])=>{
  const statements=sequence(values);expect(rewrite(statements,{rerollUnrolledLoops:true})).toEqual(chunk(statements));
});
it('does not reroll a cell with an unknown writer anywhere in a nested closure',()=>{
  const poison=fn('poison',[{kind:'assign',targets:[ident('sum')],values:[call('unknown')]}]);
  const statements=sequence([1,2,3],[poison]);
  expect(rewrite(statements,{rerollUnrolledLoops:true})).toEqual(chunk(statements));
});
it('requires a numeric initializer and rejects global or table update targets',()=>{
  for(const initializer of [call('unknown'),{kind:'table',fields:[]} as Expression]){
    const statements=sequence([1,2,3]);statements[0]=local('sum',initializer);
    expect(rewrite(statements,{rerollUnrolledLoops:true})).toEqual(chunk(statements));
  }
  const statements=sequence([1,2,3]).slice(1);
  expect(rewrite(statements,{rerollUnrolledLoops:true})).toEqual(chunk(statements));
  const table=sequence([1,2,3]).map(s=>s.kind==='compound-assign'?{...s,target:{kind:'property',object:ident('object'),name:'sum'} as Expression}:s);
  expect(rewrite(table,{rerollUnrolledLoops:true})).toEqual(chunk(table));
});
it('does not cross effects or substitute independently varying literal sites',()=>{
  const interrupted=sequence([1,2,3]);interrupted.splice(2,0,{kind:'expression-stmt',expression:call('observe')});
  expect(rewrite(interrupted,{rerollUnrolledLoops:true})).toEqual(chunk(interrupted));
  for(const expressions of [
    [add(lit(1),lit(8)),add(lit(2),lit(9)),add(lit(3),lit(10))],
    [add(lit(1),lit(8)),add(lit(2),lit(8)),add(lit(3),lit(9))],
    [add(lit(1),call('observe')),add(lit(2),call('observe')),add(lit(3),call('observe'))],
  ]) {const statements=[local('sum',lit(0)),...expressions.map(e=>update(e))];
    expect(rewrite(statements,{rerollUnrolledLoops:true})).toEqual(chunk(statements));}
});
it('resolves shadowed numeric cells independently',()=>{
  const inner=sequence([1,2,3]);inner[0]=local('sum',call('unknown'));
  const statements=[...sequence([1,2,3]).slice(0,-1),{kind:'do',body:block(inner)} as Statement];
  const result=rewrite(statements,{rerollUnrolledLoops:true});
  expect(result.body.statements[1]?.kind).toBe('numeric-for');
  expect(result.body.statements.at(-1)).toEqual(statements.at(-1));
});
it('names repeated exact mathematical literals without introducing math library lookups',()=>{
  const constants=[Math.PI,2*Math.PI,Math.E,Math.SQRT2,Math.LN2];
  const statements:Statement[]=[local('PI',lit(0)),{kind:'expression-stmt',expression:ident('TAU')},
    {kind:'return',values:[...constants,...constants].map(lit)}];
  const result=rewrite(statements,{mathConstants:true});
  const returned=result.body.statements.at(-1)!;if(returned.kind!=='return')throw Error();
  const analysis=analyzeBindings(result.body);
  expect(analysis.globals).toEqual(new Set(['TAU']));
  for(let i=0;i<constants.length;i++){
    expect(returned.values[i]?.kind).toBe('identifier');
    const binding=analysis.bindings.find(b=>b.reads.some(r=>r.node===returned.values[i]));
    expect(binding?.declaration).toMatchObject({kind:'local',values:[lit(constants[i]!)]});
    expect(binding?.writes).toHaveLength(0);expect(returned.values[i+constants.length]).toEqual(returned.values[i]);
  }
});
it('leaves singletons, nearby values, signed zero and nonfinite numbers unchanged',()=>{
  const values=[Math.PI,Math.PI+Number.EPSILON*4,-0,0,NaN,Infinity,-Infinity];
  const statements:Statement[]=[{kind:'return',values:values.map(lit)}];
  const result=rewrite(statements,{mathConstants:true});expect(result).toEqual(chunk(statements));
  const ret=result.body.statements[0];if(ret?.kind!=='return')throw Error();
  expect(Object.is((ret.values[2] as {value:number}).value,-0)).toBe(true);
});
it('removes only unreferenced private function bindings when explicitly requested',()=>{
  const expression:Expression={kind:'function-expr',params:[],isVararg:false,body:block()};
  const global=fn('published',[],false),recursive=fn('recursive',[{kind:'return',values:[call('recursive')]}]);
  const exported=local('exported',expression),write=local('written',expression);
  const statements:Statement[]=[fn('unused'),local('unusedExpr',expression),global,recursive,exported,write,
    {kind:'assign',targets:[ident('written')],values:[lit(0)]},{kind:'return',values:[ident('exported')]}];
  expect(rewrite(statements,{keepDeadFunctions:false}).body.statements).toEqual(statements.slice(2));
});
it('keeps mixed local initializers and their effects intact',()=>{
  const expression:Expression={kind:'function-expr',params:[],isVararg:false,body:block()};
  const statements:Statement[]=[{kind:'local',names:['unused','effect'],values:[expression,call('observe')]}];
  expect(rewrite(statements,{keepDeadFunctions:false})).toEqual(chunk(statements));
});
it('unfolds inert named module fields in order, leaving function values as expressions',()=>{
  const expression:Expression={kind:'function-expr',params:['value'],isVararg:false,
    body:block([{kind:'return',values:[ident('value')]}])};
  const statements:Statement[]=[local('module',{kind:'table',fields:[{name:'version',value:lit(2)},{name:'run',value:expression}]}),
    {kind:'return',values:[ident('module')]}];
  const result=rewrite(statements,{unfoldModuleTables:true});
  expect(result.body.statements).toEqual([local('module',{kind:'table',fields:[]}),
    {kind:'assign',targets:[{kind:'property',object:ident('module'),name:'version'}],values:[lit(2)]},
    {kind:'assign',targets:[{kind:'property',object:ident('module'),name:'run'}],values:[expression]},statements[1]]);
  expect(rewrite(statements,{unfoldModuleTables:false})).toEqual(chunk(statements));
});
it('does not unfold self-name initializer captures, open tails, duplicate keys or effects',()=>{
  const expression:Expression={kind:'function-expr',params:[],isVararg:false,
    body:block([{kind:'return',values:[ident('module')]}])};
  for(const fields of [
    [{name:'run',value:expression}],
    [{name:'run',value:{...expression,body:block()}},{list:true,value:call('observe')}],
    [{name:'run',value:{...expression,body:block()}},{name:'run',value:lit(1)}],
    [{name:'run',value:{...expression,body:block()}},{name:'effect',value:call('observe')}],
  ]) {const statements=[local('module',{kind:'table',fields})];
    expect(rewrite(statements,{unfoldModuleTables:true})).toEqual(chunk(statements));}
});

it('does not add constant locals above wide expression packs',()=>{
 const statements:Statement[]=[{kind:'expression-stmt',expression:{kind:'call',callee:ident('print'),
  args:Array.from({length:254},()=>lit(Math.PI)),open:false}}];
 expect(rewrite(statements,{mathConstants:true})).toEqual(chunk(statements));
});

it('accounts for outer arguments that remain live during a nested argument call',()=>{
 const inner:Expression={kind:'call',callee:ident('print'),args:Array.from({length:127},()=>lit(Math.PI)),open:false};
 const statements:Statement[]=[{kind:'expression-stmt',expression:{kind:'call',callee:ident('print'),
  args:[...Array.from({length:126},()=>lit(Math.PI)),inner],open:false}}];
 expect(rewrite(statements,{mathConstants:true})).toEqual(chunk(statements));
});
