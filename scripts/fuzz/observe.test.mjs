import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyObservation } from './observe.mjs';

const run = (text = 'trace') => ({ ok: true, status: 0, stdout: Buffer.from(text).toString('base64'), stderr: '', error: null, signal: null });

test('trace differences, runtime errors, syntax errors and timeouts remain distinct', () => {
  const originals = [run()];
  assert.equal(classifyObservation({ originals, parser: run(), runs: [run()] }).status, 'MATCH');
  assert.equal(classifyObservation({ originals, parser: run(), runs: [run('other')] }).failureKind, 'trace');
  assert.equal(classifyObservation({ originals, parser: run(), runs: [{ ...run(), ok: false, status: 1 }] }).failureKind, 'runtime-error');
  assert.equal(classifyObservation({ originals, parser: { ...run(), ok: false, status: 1 }, runs: [] }).failureKind, 'syntax');
  const timeout = { ...run(), ok: false, status: null, signal: 'SIGTERM', error: 'spawn ETIMEDOUT' };
  const interrupted = classifyObservation({ originals, parser: run(), runs: [timeout] });
  assert.equal(interrupted.status, 'NOT_MEASURED');
  assert.equal(interrupted.failureKind, 'timeout');
  assert.equal(classifyObservation({ originals: [timeout], parser: run(), runs: [run('other')] }).status, 'INVALID_ORIGINAL');
  assert.equal(classifyObservation({ originals: [run('')], parser: run(), runs: [run('other')] }).originalValid, false);
});
