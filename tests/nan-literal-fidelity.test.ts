import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {chunk, cloneAst, lit} from '../src/ast/Ast.ts';
import {formatNumber} from '../src/decode/Constant.ts';
import {decompile} from '../src/decompile.ts';
import {printLuau} from '../src/print/LuauPrinter.ts';
import {boundLocalLifetimes} from '../src/reconstruct/LocalLifetimes.ts';
import {applyOptionalRewrites} from '../src/reconstruct/OptionalRewrites.ts';

function numberOf(bits: bigint): number {
  const bytes = new DataView(new ArrayBuffer(8));
  bytes.setBigUint64(0, bits, true);
  return bytes.getFloat64(0, true);
}
function bitsOf(value: number): bigint {
  const bytes = new DataView(new ArrayBuffer(8));
  bytes.setFloat64(0, value, true);
  return bytes.getBigUint64(0, true);
}
const negative = numberOf(0xfff8000000000000n);
const positive = numberOf(0x7ff8000000000000n);

describe('observable NaN signs', () => {
  it('prints both signs without a global constructor and keeps them grouped', () => {
    expect(formatNumber(negative)).toBe('(0/0)');
    expect(formatNumber(positive)).toBe('(-(0/0))');
    expect(printLuau(chunk([{kind: 'return', values: [lit(negative), lit(positive)]}]))).toBe(
      'return (0/0), (-(0/0))\n');
  });

  it('copies AST records without canonicalizing numbers or aliasing the input', () => {
    const value = lit(numberOf(0xfff8000000001234n));
    const original = chunk([{kind: 'return', values: [value, value, lit(-0)]}]);
    const copy = cloneAst(original);
    const returned = copy.body.statements[0];
    expect(returned.kind).toBe('return');
    if (returned.kind !== 'return') throw new Error('Expected return');
    expect(returned.values[0]).not.toBe(value);
    expect(returned.values[0]).toBe(returned.values[1]);
    const first = returned.values[0]!;
    expect(first.kind).toBe('literal');
    if (first.kind !== 'literal') throw new Error('Expected literal');
    expect(bitsOf(first.value as number)).toBe(0xfff8000000001234n);
    expect(returned.values[2]).toEqual(lit(-0));
    first.value = 7;
    expect(bitsOf(value.value as number)).toBe(0xfff8000000001234n);
  });

  it.each([
    ['optional rewrites', (ast: ReturnType<typeof chunk>) => applyOptionalRewrites(ast, {unfoldModuleTables: true})],
    ['local lifetimes', (ast: ReturnType<typeof chunk>) => boundLocalLifetimes(ast)],
  ] as const)('retains both signs through %s', (_, transform) => {
    const original = chunk([{kind: 'return', values: [lit(negative), lit(positive)]}]);
    const transformed = transform(original);
    expect(transformed).not.toBe(original);
    expect(printLuau(transformed)).toBe('return (0/0), (-(0/0))\n');
  });

  it.each(['O1g1', 'O1g2', 'O2g1', 'O2g2'])('retains both compiled literal signs through the full pipeline at %s', profile => {
    const result = decompile(readFileSync(new URL(
      `fixtures/rosetta-semantics/signed-nan-literals-${profile}.luauc`, import.meta.url)), {opcodeEncoding: 'official'});
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    const signs = new Set<bigint>();
    const visit = (node: unknown): void => {
      if (!node || typeof node !== 'object') return;
      const value = node as {kind?: string; value?: unknown};
      if (value.kind === 'literal' && typeof value.value === 'number' && Number.isNaN(value.value)) {
        signs.add(bitsOf(value.value) >> 63n);
      }
      Object.values(node).forEach(visit);
    };
    visit(result.ast);
    expect(signs).toEqual(new Set([0n, 1n]));
  });
});
