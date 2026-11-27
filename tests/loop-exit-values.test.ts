import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {decompile} from '../src/decompile.ts';
import {analyzeBindings} from '../src/analysis/Bindings.ts';

const profiles = [0, 1, 2].flatMap(opt => [1, 2].map(debug => `O${opt}g${debug}`));
const names = ['overwritten-outer-flag', 'loop-local-snapshots', 'preloop-copy', 'preloop-copy-capture'];

describe('values crossing loop boundaries', () => {
  it.each(profiles)('keeps exported values and snapshots in lexical scope at %s', profile => {
    for (const name of names) {
      const result = decompile(readFileSync(new URL(
        `fixtures/loop-exit-values/${name}-${profile}.luauc`, import.meta.url)));
      expect(result.ok, name).toBe(true);
      if (!result.ok) throw new Error(result.error);
      expect(result.validation, name).toEqual([]);
      const globals = [...analyzeBindings(result.ast.body).globals];
      expect(globals.filter(global => !['print', 'tostring', 'tonumber'].includes(global)), name).toEqual([]);
    }
  });
});
