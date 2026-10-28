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
