import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {expect, it} from 'vitest';
import {analyzeBindings} from '../src/analysis/Bindings.ts';
import {decompile} from '../src/decompile.ts';

const base = new URL('./fixtures/loop-exit-work/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', base), 'utf8')) as {
  source: string; sourceSha256: string;
  entries: Array<{profile: string; bytecode: string; sha256: string}>;
};
function nodes(value: unknown, kind: string): any[] {
  if (!value || typeof value !== 'object') return [];
  const node = value as Record<string, unknown>;
  return [...(node.kind === kind ? [node] : []), ...Object.values(node).flatMap(child => nodes(child, kind))];
}

it.each(manifest.entries)('retains the exported break value at $profile', entry => {
  const source = readFileSync(new URL(manifest.source, base));
  const bytecode = readFileSync(new URL(entry.bytecode, base));
  expect(createHash('sha256').update(source).digest('hex')).toBe(manifest.sourceSha256);
  expect(createHash('sha256').update(bytecode).digest('hex')).toBe(entry.sha256);
  const result = decompile(bytecode, {opcodeEncoding: 'official'});
  if (!result.ok) throw new Error(result.error);
  expect(result.validation).toEqual([]);
  const choose = nodes(result.ast, 'function-decl').find(node => node.name === 'choose');
  expect(choose).toBeDefined();
  const loop = nodes(choose.body, 'numeric-for')[0];
  expect(loop).toBeDefined();
  // A trace write has an indexed target. The scalar write exports the chosen
  // iterator value to the enclosing scope, where the return and snapshot read it.
  const exported = nodes(loop.body, 'assign').find(node => node.targets.length === 1 &&
    node.targets[0].kind === 'identifier' && node.values.length === 1 &&
    node.values[0].kind === 'identifier' && node.values[0].name === loop.name);
  expect(exported).toBeDefined();
  const analysis = analyzeBindings(choose.body);
  const binding = analysis.bindings.find(binding => binding.writes.some(write => write.statement === exported));
  expect(binding?.scope).toBe(choose.body);
  expect([...analyzeBindings(result.ast.body).globals].sort()).toEqual(['print', 'table']);
});
