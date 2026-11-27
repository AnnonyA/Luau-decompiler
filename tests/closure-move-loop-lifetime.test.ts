import {readFileSync} from 'node:fs';
import {expect, it} from 'vitest';
import {analyzeBindings, type LexicalBinding} from '../src/analysis/Bindings.ts';
import type {Expression} from '../src/ast/Ast.ts';
import {decompile} from '../src/decompile.ts';
import {abc, ad, CaptureType, compile, Opcode, proto} from './helpers.ts';

function unparen(value: Expression): Expression {
  return value.kind === 'paren' ? unparen(value.expression) : value;
}

function owner(bindings: LexicalBinding[], value: Expression): LexicalBinding | undefined {
  const node = unparen(value);
  return bindings.find(binding => binding.reads.some(reference => reference.node === node));
}

function assertStableCallees(bytes: Uint8Array, printed: boolean): void {
  const result = decompile(bytes, {opcodeEncoding: 'official'});
  expect(result.ok).toBe(true);
  if (!result.ok) throw Error(result.error);
  expect(result.validation).toEqual([]);
  const tail = result.ast.body.statements.at(-1)!;
  const values = printed && tail.kind === 'expression-stmt' && tail.expression.kind === 'call'
    ? tail.expression.args : !printed && tail.kind === 'return' ? tail.values : [];
  expect(values.length).toBeGreaterThanOrEqual(2);
  const callees = values.slice(0, 2).map(value => {
    const call = unparen(value);
    expect(call.kind).toBe('call');
    if (call.kind !== 'call') throw Error('missing saved-closure call');
    return call.callee;
  });
  const bindings = analyzeBindings(result.ast.body).bindings;
  const saved = owner(bindings, callees[0]!);
  expect(saved).toBeDefined();
  expect(owner(bindings, callees[1]!)).toBe(saved);
  // A branch-local snapshot cannot protect a saved MOVE value after the loop.
  // Its actual callee binding must have no later numeric assignment at all.
  const nonCreationWrites = saved!.writes.filter(reference => {
    const statement = reference.statement;
    if (statement.kind === 'function-decl') return false;
    if (statement.kind !== 'assign') return true;
    const index = statement.targets.indexOf(reference.node);
    return statement.values[index]?.kind !== 'function-expr';
  });
  expect(nonCreationWrites).toEqual([]);
  expect(saved!.scope).toBe(result.ast.body);
}

it.each([9, 14].flatMap(version => [0, 1, 2].map(optimization => ({version, optimization}))))(
  'preserves the moved stop closure across loop scratch reuse in v$version/O$optimization',
  ({version, optimization}) => {
    assertStableCallees(readFileSync(new URL(
      `./fixtures/loop-register-lifetimes/move-closure-loop-v${version}-O${optimization}.luauc`, import.meta.url)), true);
  },
);

type Mode = 'saved-open' | 'saved-closed' | 'ref-cell' | 'live-entry';

function loopBytecode(mode: Mode): Uint8Array {
  const saved = mode.startsWith('saved');
  const instructions: number[] = [], labels = new Map<string, number>();
  const jumps: {pc: number; opcode: Opcode; register: number; target: string}[] = [];
  const emit = (...words: number[]) => { instructions.push(...words); };
  const label = (name: string) => { labels.set(name, instructions.length); };
  const jump = (opcode: Opcode, register: number, target: string, aux?: number) => {
    jumps.push({pc: instructions.length, opcode, register, target});
    emit(0);
    if (aux !== undefined) emit(aux);
  };
  emit(ad(Opcode.LOADN, 0, mode === 'live-entry' ? 0 : 3));
  if (saved) {
    emit(abc(Opcode.LOADB, 1, 1), ad(Opcode.NEWCLOSURE, 7, 0),
      abc(Opcode.CAPTURE, CaptureType.REF, 1), abc(Opcode.MOVE, 2, 7));
    if (mode === 'saved-closed') emit(abc(Opcode.CLOSEUPVALS, 1));
  } else {
    emit(ad(Opcode.LOADN, 7, 5));
    if (mode === 'ref-cell') emit(ad(Opcode.NEWCLOSURE, 2, 0), abc(Opcode.CAPTURE, CaptureType.REF, 7));
  }
  emit(abc(Opcode.MOVE, 3, 0), ad(Opcode.LOADN, 4, 1), ad(Opcode.LOADN, 5, 1), ad(Opcode.LOADN, 6, 0));
  jump(Opcode.FORNPREP, 3, 'exit');
  label('loop');
  jump(Opcode.JUMPXEQKN, 5, 'else', 0x80000000);
  emit(ad(Opcode.LOADN, 7, 11));
  jump(Opcode.JUMP, 0, 'join');
  label('else'); emit(ad(Opcode.LOADN, 7, 22));
  label('join'); emit(abc(Opcode.ADD, 6, 6, 7));
  jump(Opcode.FORNLOOP, 3, 'loop');
  label('exit');
  if (saved) {
    emit(abc(Opcode.MOVE, 8, 2), abc(Opcode.CALL, 8, 1, 2),
      abc(Opcode.MOVE, 9, 2), abc(Opcode.CALL, 9, 1, 2), abc(Opcode.MOVE, 10, 6), abc(Opcode.RETURN, 8, 4));
  } else if (mode === 'ref-cell') {
    emit(abc(Opcode.MOVE, 8, 2), abc(Opcode.CALL, 8, 1, 2), abc(Opcode.RETURN, 8, 2));
  } else emit(abc(Opcode.RETURN, 7, 2));
  for (const fixup of jumps) instructions[fixup.pc] = ad(fixup.opcode, fixup.register, labels.get(fixup.target)! - fixup.pc - 1);
  const child = saved
    ? proto({maxStackSize: 2, numUpvalues: 1, debugName: 'stop', instructions: [
      abc(Opcode.GETUPVAL, 0, 0), abc(Opcode.LOADB, 1, 0), abc(Opcode.SETUPVAL, 1, 0), abc(Opcode.RETURN, 0, 2),
    ]})
    : proto({numUpvalues: 1, debugName: 'readCell', instructions: [abc(Opcode.GETUPVAL, 0, 0), abc(Opcode.RETURN, 0, 2)]});
  return compile(proto({maxStackSize: 11, instructions, constants: [{kind: 'number', value: 1}], children: [child]}));
}

it.each(['saved-open', 'saved-closed'] as const)(
  'does not assign scratch-phi numbers into a MOVE alias (%s)', mode => assertStableCallees(loopBytecode(mode), false),
);

it('keeps loop writes attached to an open REF cell even when no instruction reads its entry value', () => {
  const result = decompile(loopBytecode('ref-cell'), {opcodeEncoding: 'official'});
  expect(result.ok).toBe(true);
  if (!result.ok) throw Error(result.error);
  expect(result.validation).toEqual([]);
  const bindings = analyzeBindings(result.ast.body).bindings;
  const cell = bindings.find(binding => binding.captured && binding.declaration.kind === 'local' &&
    binding.declaration.values.some(value => value.kind === 'literal' && value.value === 5));
  expect(cell).toBeDefined();
  expect(cell!.scope).toBe(result.ast.body);
  expect(cell!.writes.length).toBeGreaterThan(0);
  expect(cell!.writes.some(reference => reference.scope !== result.ast.body)).toBe(true);
});

it('retains the entry value when the zero-iteration continuation reads that register', () => {
  const result = decompile(loopBytecode('live-entry'), {opcodeEncoding: 'official'});
  expect(result.ok).toBe(true);
  if (!result.ok) throw Error(result.error);
  expect(result.validation).toEqual([]);
  const tail = result.ast.body.statements.at(-1)!;
  expect(tail.kind).toBe('return');
  if (tail.kind !== 'return') throw Error('missing return');
  const binding = owner(analyzeBindings(result.ast.body).bindings, tail.values[0]!);
  expect(binding?.declaration.kind).toBe('local');
  if (binding?.declaration.kind !== 'local') throw Error('missing entry declaration');
  expect(binding.declaration.values).toContainEqual(expect.objectContaining({kind: 'literal', value: 5}));
  expect(binding.scope).toBe(result.ast.body);
  expect(binding.writes.length).toBeGreaterThan(0);
});
