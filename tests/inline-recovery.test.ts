import {expect, it} from 'vitest';
import {readFileSync} from 'node:fs';
import {block, chunk, ident, lit, type Expression, type Statement} from '../src/ast/Ast.ts';
import {recoverInlineCalls} from '../src/reconstruct/InlineRecovery.ts';
import {decompile} from '../src/decompile.ts';
import {decodeBytecode} from '../src/decode/Decoder.ts';
import {lineAt} from '../src/decode/Prototype.ts';
import {Opcode} from '../src/decode/Opcode.ts';

const formula = (value: Expression): Expression => ({kind:'binary',op:'+',
  left:{kind:'binary',op:'*',left:value,right:lit(7)},right:lit(3)});
const helper = (): Extract<Statement,{kind:'function-decl'}> => ({kind:'function-decl',local:true,name:'weighted',
  params:['value'],isVararg:false,line:1,body:block([{kind:'return',values:[formula(ident('value'))]}])});
const site = (value: Expression): Statement => ({kind:'local',names:['score'],values:[formula(value)]});
const loop = (body: Statement[]): Statement => ({kind:'numeric-for',name:'index',start:lit(-5),stop:lit(12),step:lit(2),body:block(body)});
function recovered(statements: Statement[], evidence = new Set([1])) {
  const input = chunk(statements), before = structuredClone(input);
  const output = recoverInlineCalls(input,evidence);
  expect(input).toEqual(before);
  const calls: Expression[] = [];
  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    if ((node as Expression).kind === 'call') calls.push(node as Expression);
    for (const value of Object.values(node)) Array.isArray(value) ? value.forEach(visit) : visit(value);
  };
  visit(output);
  return calls.filter(e=>e.kind==='call' && e.callee.kind==='identifier' && e.callee.name==='weighted');
}
it('recovers an exact helper call for a stable numeric loop value',()=>{
  expect(recovered([helper(),loop([site(ident('index'))])])).toEqual([
    {kind:'call',callee:ident('weighted'),args:[ident('index')],open:false},
  ]);
});
it('requires bytecode evidence and a preceding helper declaration',()=>{
  expect(recovered([helper(),loop([site(ident('index'))])],new Set())).toHaveLength(0);
  expect(recovered([loop([site(ident('index'))]),helper()])).toHaveLength(0);
});
it('does not call a shadowed helper or a reassigned function binding',()=>{
  expect(recovered([helper(),loop([{kind:'local',names:['weighted'],values:[lit(0)]},site(ident('index'))])])).toHaveLength(0);
  expect(recovered([helper(),loop([site(ident('index'))]),{kind:'assign',targets:[ident('weighted')],values:[lit(null)]}])).toHaveLength(0);
});
it('does not move effectful arguments or assume unknown values cannot invoke metamethods',()=>{
  expect(recovered([helper(),loop([site({kind:'call',callee:ident('nextValue'),args:[],open:false})])])).toHaveLength(0);
  expect(recovered([helper(),{kind:'local',names:['unknown'],values:[{kind:'vararg'}]},site(ident('unknown'))])).toHaveLength(0);
});
it('does not reconstruct helpers with free captures or multiple return values',()=>{
  const captured = helper(); captured.body=block([{kind:'return',values:[formula(ident('bias'))]}]);
  expect(recovered([captured,loop([site(ident('index'))])])).toHaveLength(0);
  const multiple = helper(); multiple.body=block([{kind:'return',values:[formula(ident('value')),lit(1)]}]);
  expect(recovered([multiple,loop([site(ident('index'))])])).toHaveLength(0);
});
it('rejects numeric locals that can be written by a closure',()=>{
  const writer: Statement = {kind:'function-decl',name:'mutate',local:true,params:[],isVararg:false,
    body:block([{kind:'assign',targets:[ident('number')],values:[lit('changed')]}])};
  expect(recovered([helper(),{kind:'local',names:['number'],values:[lit(3)]},writer,site(ident('number'))])).toHaveLength(0);
});
it('requires repeated parameter occurrences to name the same numeric value',()=>{
  const square=helper();
  square.body=block([{kind:'return',values:[{kind:'binary',op:'+',left:{kind:'binary',op:'*',left:ident('value'),right:ident('value')},right:lit(3)}]}]);
  const mixed: Statement={kind:'local',names:['score'],values:[{kind:'binary',op:'+',
    left:{kind:'binary',op:'*',left:ident('index'),right:{kind:'binary',op:'+',left:ident('index'),right:lit(1)}},right:lit(3)}]};
  expect(recovered([square,loop([mixed])])).toHaveLength(0);
});
it('does not use a repeat-body helper in until when continue can skip its declaration',()=>{
  const repeated: Statement={kind:'repeat',body:block([
    {kind:'if',test:ident('skip'),consequent:block([{kind:'continue'}]),branches:[]},helper(),
  ]),test:{kind:'binary',op:'>',left:formula(ident('index')),right:lit(0)}};
  expect(recovered([loop([repeated])])).toHaveLength(0);
});
it('restores calls expanded by official O2 without changing the helper return expression',()=>{
  const bytes=readFileSync(new URL('./fixtures/object-optimized/inlined-numeric-helper-O2.luauc',import.meta.url));
  const result=decompile(bytes,{opcodeEncoding:'official'});
  expect(result.ok).toBe(true);if(!result.ok)throw Error(result.error);
  expect(result.validation).toEqual([]);
  expect(result.source).toMatch(/weighted\(index\)/);
  expect(result.source).toMatch(/weighted\(index \+ 1\)/);
  const disabled=decompile(bytes,{opcodeEncoding:'official',recoverInlinedFunctions:false});
  expect(disabled.ok).toBe(true);
  if(disabled.ok)expect(disabled.source).not.toMatch(/weighted\(index/);
});

it('decodes backwards O2 line deltas with the official unsigned-byte wraparound',()=>{
  const bytes=readFileSync(new URL('./fixtures/object-optimized/inlined-numeric-helper-O2.luauc',import.meta.url));
  const {module}=decodeBytecode(bytes,{opcodeEncoding:'official'});
  const main=module.prototypes[module.mainProtoId]!;
  const copies=main.instructions.filter(i=>i.opcode===Opcode.MULK);
  expect(copies).toHaveLength(2);
  expect(copies.map(i=>lineAt(main,i.pc))).toEqual([2,2]);
});

it('accumulates line bases and carries byte offsets across line-info intervals',()=>{
  const bytes=readFileSync(new URL('./fixtures/object-optimized/inlined-numeric-helper-O2.luauc',import.meta.url));
  const {module}=decodeBytecode(bytes,{opcodeEncoding:'official'});
  const proto={...module.prototypes[0]!,code:new Uint32Array(5),lineInfo:{lineGapLog2:1,
    deltas:Uint8Array.from([250,10,251,7,3]),absolute:Int32Array.from([100,300,-200])}};
  expect([0,1,2,3,4].map(pc=>lineAt(proto,pc))).toEqual([350,104,655,406,209]);
});

const selected = (value: Expression): Expression => ({kind:'if-expr',
  test:{kind:'binary',op:'<',left:value,right:lit(-2)},consequent:formula(value),
  branches:[{test:{kind:'binary',op:'>',left:value,right:lit(4)},value:{kind:'unary',op:'-',argument:formula(value)}}],
  alternate:{kind:'binary',op:'*',left:value,right:value}});
it('recovers a conditional helper without changing elseif or operand order',()=>{
  const conditional=helper();conditional.body=block([{kind:'return',values:[selected(ident('value'))]}]);
  expect(recovered([conditional,loop([{kind:'local',names:['result'],values:[selected(ident('index'))]}])])).toHaveLength(1);
});
it('matches early-return CFG arms against a scalar selection',()=>{
  const conditional=helper();
  conditional.body=block([
    {kind:'if',test:{kind:'binary',op:'<',left:ident('value'),right:lit(-2)},
      consequent:block([{kind:'return',values:[formula(ident('value'))]}]),
      branches:[{test:{kind:'binary',op:'>',left:ident('value'),right:lit(4)},
        body:block([{kind:'return',values:[{kind:'unary',op:'-',argument:formula(ident('value'))}]}])}]},
    {kind:'return',values:[{kind:'binary',op:'*',left:ident('value'),right:ident('value')}]},
  ]);
  expect(recovered([conditional,loop([{kind:'local',names:['result'],values:[selected(ident('index'))]}])])).toHaveLength(1);
});
it('resolves immutable numeric local dependencies on both sides of a match',()=>{
  const conditional=helper();
  conditional.body=block([{kind:'local',names:['adjusted'],values:[formula(ident('value'))]},
    {kind:'return',values:[selected(ident('adjusted'))]}]);
  expect(recovered([conditional,loop([{kind:'local',names:['shifted'],values:[formula(ident('index'))]},
    {kind:'local',names:['result'],values:[selected(ident('shifted'))]}])])).toHaveLength(1);
});
it('preserves the lexical identity of stable numeric captures',()=>{
  const captured=helper();captured.body=block([{kind:'return',values:[{kind:'binary',op:'+',
    left:formula(ident('value')),right:ident('offset')}]}]);
  const call: Statement={kind:'local',names:['result'],values:[{kind:'binary',op:'+',left:formula(ident('index')),right:ident('offset')}]};
  const prefix: Statement[]=[{kind:'local',names:['offset'],values:[lit(11)]},captured];
  expect(recovered([...prefix,loop([call])])).toHaveLength(1);
  expect(recovered([...prefix,loop([{kind:'local',names:['offset'],values:[lit(12)]},call])])).toHaveLength(0);
  expect(recovered([...prefix,loop([call]),{kind:'assign',targets:[ident('offset')],values:[lit(2)]}])).toHaveLength(0);
});
it('does not erase effects, partial returns or mutable locals while building a helper template',()=>{
  const effects=helper();effects.body.statements.unshift({kind:'local',names:['unused'],values:[{kind:'call',callee:ident('tick'),args:[],open:false}]});
  expect(recovered([effects,loop([site(ident('index'))])])).toHaveLength(0);
  const partial=helper();partial.body=block([{kind:'if',test:ident('value'),consequent:partial.body,branches:[]}]);
  expect(recovered([partial,loop([site(ident('index'))])])).toHaveLength(0);
  const mutable=helper();mutable.body=block([{kind:'local',names:['v'],values:[ident('value')]},
    {kind:'assign',targets:[ident('v')],values:[lit(0)]},{kind:'return',values:[formula(ident('v'))]}]);
  expect(recovered([mutable,loop([site(ident('index'))])])).toHaveLength(0);
});
it('does not move an effectful or metamethod-capable test into a conditional helper',()=>{
  const conditional=helper();conditional.body=block([{kind:'return',values:[selected(ident('value'))]}]);
  expect(recovered([conditional,{kind:'local',names:['result'],values:[selected({kind:'call',callee:ident('nextValue'),args:[],open:false})]}])).toHaveLength(0);
  expect(recovered([conditional,{kind:'local',names:['unknown'],values:[{kind:'vararg'}]},
    {kind:'local',names:['result'],values:[selected(ident('unknown'))]}])).toHaveLength(0);
});
it('leaves an expression intact when two retained helpers are equally valid matches',()=>{
  const rival=helper();rival.name='alternative';rival.line=2;
  const input=chunk([helper(),rival,loop([site(ident('index'))])]);
  expect(recoverInlineCalls(input,new Set([1,2]))).toEqual(input);
});
it('recovers real O2 branch helpers and loop captures while refusing a mutable capture',()=>{
  const run=(name:string)=>{
    const bytes=readFileSync(new URL(`./fixtures/object-optimized/${name}-O2.luauc`,import.meta.url));
    const result=decompile(bytes,{opcodeEncoding:'official'});
    expect(result.ok).toBe(true);if(!result.ok)throw Error(result.error);
    expect(result.validation).toEqual([]);return result.source;
  };
  const returned=run('inlined-conditional-returns');
  expect(returned).toMatch(/band\(index\)/);
  expect(returned).toMatch(/shifted\(index\)/);
  const captured=run('inlined-conditional-captures');
  expect(captured).toMatch(/weighted\(j\)/);
  expect(captured).not.toMatch(/mutable\(i\)/);
});
it('does not capture a new binding when recovering an argument from an earlier initializer',()=>{
  const weighted=helper();
  weighted.body=block([{kind:'return',values:[{kind:'binary',op:'+',left:{kind:'binary',op:'*',
    left:{kind:'binary',op:'+',left:ident('value'),right:lit(1)},right:lit(2)},right:lit(3)}]}]);
  const declaration: Statement={kind:'local',names:['shifted'],values:[{kind:'binary',op:'+',left:ident('offset'),right:lit(1)}]};
  const site: Statement={kind:'local',names:['result'],values:[{kind:'binary',op:'+',left:{kind:'binary',op:'*',left:ident('shifted'),right:lit(2)},right:lit(3)}]};
  const prefix: Statement[]=[weighted,{kind:'local',names:['offset'],values:[lit(1)]},declaration];
  const shadow: Statement={kind:'local',names:['offset'],values:[lit(100)]};
  for(const suffix of [[shadow,site],[{kind:'do',body:block([shadow,site])} as Statement],
    [{kind:'numeric-for',name:'offset',start:lit(100),stop:lit(101),body:block([site])} as Statement],
    [{kind:'generic-for',names:['offset'],iterators:[ident('entries')],body:block([site])} as Statement]]) {
    const input=chunk([...prefix,...suffix]);
    expect(recoverInlineCalls(input,new Set([1]))).toEqual(input);
  }
  // Local initializers still see the outer binding, before parallel declarations.
  const input=chunk([...prefix,{kind:'local',names:['offset','result'],values:[lit(100),site.values[0]!]}]);
  const last=recoverInlineCalls(input,new Set([1])).body.statements.at(-1)!;
  expect(last.kind==='local' && last.values[1]).toEqual({kind:'call',callee:ident('weighted'),args:[ident('offset')],open:false});
});
