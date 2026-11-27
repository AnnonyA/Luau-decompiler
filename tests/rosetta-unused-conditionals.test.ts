import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {expect, it} from 'vitest';
import {analyzeBindings} from '../src/analysis/Bindings.ts';
import {decompile} from '../src/decompile.ts';

const fixture = (name: string) => readFileSync(new URL(`fixtures/rosetta-unused-conditionals/${name}`, import.meta.url));
const manifest = JSON.parse(fixture('manifest.json').toString()) as {
  entries: Array<{name: string; profile: string; source: string; sourceSha256: string; bytecode: string; sha256: string}>;
};
function nodes(value: unknown, kind: string): Record<string, any>[] {
  if (!value || typeof value !== 'object') return [];
  const node = value as Record<string, any>;
  return [...(node.kind === kind ? [node] : []), ...Object.values(node).flatMap(child => nodes(child, kind))];
}

for (const entry of manifest.entries) {
  it(`preserves observable ${entry.name} evaluations at ${entry.profile}`, () => {
    const bytes = fixture(entry.bytecode);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256);
    expect(createHash('sha256').update(fixture(entry.source)).digest('hex')).toBe(entry.sourceSha256);
    const result = decompile(bytes, {opcodeEncoding: 'official'});
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.validation).toEqual([]);
    if (entry.name === 'unused-conditional-effects' && !entry.profile.startsWith('O2')) {
      // O2 can inline these calls and remove the proved untaken arm. O0/O1
      // retain all six call sites, including the guard with an empty body.
      const calls = nodes(result.ast, 'call').filter(call =>
        nodes(call.callee, 'identifier').some(name => name.name === 'observe'));
      expect(calls).toHaveLength(6);
    }
    if (entry.name === 'unused-conditional-metamethods') {
      const operators = nodes(result.ast, 'binary').map(node => node.op);
      expect(operators.filter(op => op === '<')).toHaveLength(2);
      expect(operators.filter(op => op === '<=')).toHaveLength(1);
      expect(operators.filter(op => op === '==')).toHaveLength(1);
    }
    if (entry.name === 'unused-conditional-global-name') {
      const bindings = analyzeBindings(result.ast.body);
      expect(bindings.globals.has('_')).toBe(true);
      expect(bindings.bindings.some(binding => binding.name === '_')).toBe(false);
    }
  });
}
