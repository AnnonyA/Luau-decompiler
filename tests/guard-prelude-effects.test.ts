import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {analyzeBindings} from '../src/analysis/Bindings.ts';
import {decompile} from '../src/decompile.ts';

const profiles = [0, 1, 2].flatMap(opt => [1, 2].map(debug => `O${opt}g${debug}`));
describe('guard preludes retain unused call evaluations', () => {
  for (const name of ['unused-call-before-guard', 'unused-loop-call-before-pack']) {
    it.each(profiles)(`${name} retains every declared closure's invocation at %s`, profile => {
      const result = decompile(readFileSync(new URL(
        `fixtures/rosetta-evaluation/${name}-${profile}.luauc`, import.meta.url)));
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.error);
      expect(result.validation).toEqual([]);
      const bindings = analyzeBindings(result.ast.body).bindings;
      for (const binding of bindings) {
        const declaration = binding.declaration;
        if (declaration.kind === 'function-decl' ||
            (declaration.kind === 'local' && declaration.values[0]?.kind === 'function-expr')) {
          expect(binding.reads.length, binding.name).toBeGreaterThan(0);
        }
      }
    });
  }
});
