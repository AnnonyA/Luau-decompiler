import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {analyzeBindings} from '../src/analysis/Bindings.ts';
import {decompile} from '../src/decompile.ts';

const profiles = [
  'O0g1', 'O1g1', 'O2g1', 'O0g2', 'O1g2', 'O2g2',
  'O0g1+x1', 'O1g1+x2', 'O2g1+x3', 'O0g2+x2', 'O1g2+x3', 'O2g2+x1',
];
function nodes(value: unknown, kind: string): any[] {
  if (!value || typeof value !== 'object') return [];
  const node = value as Record<string, unknown>;
  return [...(node.kind === kind ? [node] : []), ...Object.values(node).flatMap(child => nodes(child, kind))];
}

describe.each(['terminal-iterator-continuation', 'terminal-iterator-effects'])('%s', name => {
  it.each(profiles)('keeps the continuation bindings and first-iteration break at %s', profile => {
    const bytes = readFileSync(new URL(`fixtures/rosetta-semantics/${name}-${profile}.luauc`, import.meta.url));
    const result = decompile(bytes, {opcodeEncoding: 'official'});
    if (!result.ok) throw new Error(result.error);
    expect(result.validation).toEqual([]);
    const loops = nodes(result.ast, 'generic-for');
    expect(loops.length).toBeGreaterThan(0);
    for (const loop of loops) expect(loop.body.statements).toEqual([{kind: 'break'}]);
    const allowedGlobals = new Set(['print', 'math', 'table', 'rawequal']);
    const globals = [...analyzeBindings(result.ast.body).globals];
    expect(globals.filter(global => !allowedGlobals.has(global))).toEqual([]);
  });
});
