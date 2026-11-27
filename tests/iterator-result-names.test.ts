import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {decompile} from '../src/decompile.ts';

const profiles = [0, 1, 2].flatMap(opt => [1, 2].map(debug => `O${opt}g${debug}`));
function nodes(value: unknown, kind: string): any[] {
  if (!value || typeof value !== 'object') return [];
  const node = value as Record<string, unknown>;
  return [...(node.kind === kind ? [node] : []), ...Object.values(node).flatMap(child => nodes(child, kind))];
}

describe('distinct iterator results in a shuffled loop region', () => {
  it.each(profiles)('keeps both live results when the follow precedes the body (%s)', profile => {
    const bytes = readFileSync(new URL(
      `fixtures/rosetta-semantics/iterator-shuffled-follow-${profile}-permuted.luauc`, import.meta.url));
    const result = decompile(bytes, {opcodeEncoding: 'official'});
    if (!result.ok) throw new Error(result.error);
    expect(result.validation).toEqual([]);
    const loops = nodes(result.ast, 'generic-for');
    expect(loops).toHaveLength(1);
    const loop = loops[0];
    expect(loop.names).toHaveLength(2);
    expect(new Set(loop.names).size).toBe(2);
    expect(loop.names).not.toContain('_');
    const print = nodes(loop.body, 'call').find(call => call.callee.kind === 'identifier' && call.callee.name === 'print');
    expect(print.args.map((arg: any) => arg.name)).toEqual(loop.names);
  });
});
