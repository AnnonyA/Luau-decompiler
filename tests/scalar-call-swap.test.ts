import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {decompile} from '../src/decompile.ts';
import {printWithoutCallBoundaries} from './helpers.ts';

const profiles = [0, 1, 2].flatMap(opt => [1, 2].map(debug => `O${opt}g${debug}`));

describe('scalar call results next to parallel register copies', () => {
  it.each(profiles)('does not widen a scalar math.min result to a tuple at %s', profile => {
    const result = decompile(readFileSync(new URL(
      `fixtures/scalar-call-swap/scalar-result-swap-${profile}.luauc`, import.meta.url)));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.validation).toEqual([]);
    const source = printWithoutCallBoundaries(result.ast);
    expect(source).not.toMatch(/local \w+, \w+ = math\.min\(/);
    expect(source).toContain('math.min(');
  });
});
