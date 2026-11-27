import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {decompile} from '../src/decompile.ts';

const normal = [0, 1, 2].flatMap(opt => [1, 2].map(debug => `O${opt}g${debug}`));
const hard = ['O0g1+x1', 'O1g1+x2', 'O2g1+x3', 'O0g2+x2', 'O1g2+x3', 'O2g2+x1'];
const fixture = (profile: string) => readFileSync(new URL(
  `fixtures/rosetta-semantics/conditional-backedge-${profile}.luauc`, import.meta.url));
function nodes(value: unknown, kind: string): any[] {
  if (!value || typeof value !== 'object') return [];
  const node = value as Record<string, unknown>;
  return [...(node.kind === kind ? [node] : []), ...Object.values(node).flatMap(child => nodes(child, kind))];
}

describe('conditional transfers to a while backedge', () => {
  it.each([...normal, ...hard])('retains both selected branch bodies at %s', profile => {
    const result = decompile(fixture(profile), {opcodeEncoding: 'official'});
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.validation).toEqual([]);
    expect(nodes(result.ast, 'while')).toHaveLength(1);
    const literals = nodes(result.ast, 'literal').map(node => node.value);
    expect(literals).toContain('even');
    expect(literals).toContain('other');
  });

  it.each(['O1g1+x2', 'O2g1+x3', 'O1g2+x3'])('does not fall through from an earlier JUMPBACK arm at %s', profile => {
    const result = decompile(fixture(profile), {opcodeEncoding: 'official'});
    if (!result.ok) throw new Error(result.error);
    const selected = nodes(result.ast, 'if').find(statement =>
      nodes(statement.consequent, 'literal').some(value => value.value === 'even'));
    expect(selected).toBeDefined();
    expect(selected.consequent.statements.at(-1).kind).toBe('continue');
  });
});
