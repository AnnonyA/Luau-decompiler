import {expect, it} from 'vitest';
import {decompile} from '../src/decompile.ts';
import {analyzeBindings} from '../src/analysis/Bindings.ts';
import {abc, ad, CaptureType, compile, Opcode, proto} from './helpers.ts';

it('repeats native cache checks for an unknown main argument without a source equality test', () => {
  // The same SSA vararg can be a table, number, NaN, or function. Equality of
  // captured objects belongs to DUPCLOSURE, not to a compile-time reflexivity
  // guess or a Lua == expression. The official host environment-pairs fixture
  // additionally executes this shape across five activations of one load.
  const bytes = compile(proto({maxStackSize: 3, isVararg: true,
    children: [proto({numUpvalues: 1, instructions: [abc(Opcode.GETUPVAL, 0, 0), abc(Opcode.RETURN, 0, 2)]})],
    constants: [{kind: 'closure', protoId: 0}], instructions: [
      abc(Opcode.PREPVARARGS, 0), abc(Opcode.GETVARARGS, 0, 2),
      ad(Opcode.DUPCLOSURE, 1, 0), abc(Opcode.CAPTURE, CaptureType.VAL, 0),
      ad(Opcode.DUPCLOSURE, 2, 0), abc(Opcode.CAPTURE, CaptureType.VAL, 0), abc(Opcode.RETURN, 1, 3),
    ]}));
  const result = decompile(bytes);
  expect(result.ok).toBe(true);
  if (!result.ok) throw Error(result.error);
  expect(result.validation).toEqual([]);
  expect(result.diagnostics.some(d => d.code === 'closure-identity-unresolved')).toBe(false);
  const carrier = result.ast.body.statements.find(statement => statement.kind === 'function-decl');
  expect(carrier?.kind).toBe('function-decl');
  if (carrier?.kind !== 'function-decl') throw Error('expected a native carrier');
  expect(carrier.isVararg).toBe(true);
  expect(carrier.params).toEqual([]);
  expect(carrier.body.statements).toHaveLength(1);
  const returned = carrier.body.statements[0]!;
  expect(returned.kind).toBe('return');
  if (returned.kind !== 'return') throw Error('expected one physical closure');
  expect(returned.values[0]?.kind).toBe('function-expr');
  const bindings = analyzeBindings(result.ast.body).bindings;
  const binding = bindings.find(binding => binding.declaration === carrier)!;
  expect(binding.reads).toHaveLength(2);
  expect(result.source).not.toContain('==');
  expect(result.source).not.toContain('--!optimize');
  const input = bindings.find(binding => binding.declaration.kind === 'local' &&
    binding.declaration.values[0]?.kind === 'vararg');
  expect(input).toBeDefined();
  expect(input!.captured).toBe(true);
  expect(input!.writes).toHaveLength(0);
});
