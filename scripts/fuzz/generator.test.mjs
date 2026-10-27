import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateProgram } from './generator.mjs';

test('a seed reproduces source and inputs after unrelated generations', () => {
  const first = generateProgram(137);
  generateProgram(138);
  assert.deepEqual(generateProgram(137), first);
  const programs = Array.from({ length: 32 }, (_, seed) => generateProgram(seed));
  assert.equal(new Set(programs.map(p => p.source)).size, 32);
  for (const program of programs) {
    assert.ok(program.source.length < 24_000);
    assert.deepEqual([...program.features].sort(), ['aliasing', 'captures', 'loops', 'multiple-returns', 'side-effects']);
    assert.equal(program.inputs.length, 3);
  }
});

test('generator rejects seeds and sizes that cannot be reproduced or bounded', () => {
  for (const seed of [-1, 2 ** 32, 0.1, NaN, '1']) assert.throws(() => generateProgram(seed), /seed/);
  for (const extraBlocks of [-1, 13, 0.5]) assert.throws(() => generateProgram(1, { extraBlocks }), /extraBlocks/);
  assert.ok(generateProgram(1, { extraBlocks: 0 }).source.length < generateProgram(1, { extraBlocks: 12 }).source.length);
});
