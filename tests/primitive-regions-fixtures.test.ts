import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {expect, it} from 'vitest';
import {analyzeBindings} from '../src/analysis/Bindings.ts';
import {decompile} from '../src/decompile.ts';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/primitive-regions/${name}`, import.meta.url));
const manifest = JSON.parse(fixture('manifest.json').toString()) as {
  source: string; sourceSha256: string; entries: Array<{profile: string; bytecode: string; sha256: string}>;
};
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
for (const entry of manifest.entries) {
  it(`preserves sealed primitive, tuple, frame and opaque-iterator controls at ${entry.profile}`, () => {
    const bytes = fixture(entry.bytecode);
    expect(hash(bytes)).toBe(entry.sha256);
    expect(hash(fixture(manifest.source))).toBe(manifest.sourceSha256);
    const result = decompile(bytes, {opcodeEncoding: 'official'});
    if (!result.ok) throw new Error(result.error);
    expect(result.validation).toEqual([]);
    expect(result.diagnostics.filter(item => item.severity === 'error')).toEqual([]);
    expect([...analyzeBindings(result.ast.body).globals].sort()).toEqual(['debug', 'print', 'select', 'setmetatable', 'table']);
    expect(result.source).not.toContain('--!optimize');
  });
}
it('recovers the authored scalar regions only when the option permits them', () => {
  const bytes = fixture('O2g2.luauc');
  const enabled = decompile(bytes, {opcodeEncoding: 'official'});
  const disabled = decompile(bytes, {opcodeEncoding: 'official', recoverInlinedFunctions: false});
  if (!enabled.ok || !disabled.ok) throw Error('failed authored control');
  const recoveredCalls = (root: unknown, name: string): number => {
    if (!root || typeof root !== 'object') return 0;
    const node = root as {kind?: string; callee?: {kind?: string; name?: string}; preserveBoundary?: boolean};
    const own = node.kind === 'call' && node.callee?.kind === 'identifier' && node.callee.name === name && !node.preserveBoundary ? 1 : 0;
    return own + Object.values(root).reduce<number>((count, child) => count + recoveredCalls(child, name), 0);
  };
  expect(recoveredCalls(enabled.ast, 'squares')).toBe(1);
  expect(recoveredCalls(disabled.ast, 'squares')).toBe(0);
  // This larger helper keeps its original calls: the test does not assume
  // that every compiler revision chooses to inline every loop helper.
  expect(recoveredCalls(enabled.ast, 'steps')).toBe(0);
  expect(enabled.source).toMatch(/locate\(\{ 7, 8, 9 \}, 9\)/);
  expect(disabled.source).not.toMatch(/locate\(\{ 7, 8, 9 \}, 9\)/);
});
