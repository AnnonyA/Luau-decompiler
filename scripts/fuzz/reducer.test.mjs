import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { reduceSource, failureSignature } from './reducer.mjs';

// This predicate executes both programs; accepting a syntactically broken
// deletion or a timeout would give a different result from a trace mismatch.
function observeArithmetic(source) {
  try {
    const original = vm.runInNewContext(source, {}, { timeout: 50 });
    const recovered = vm.runInNewContext(source.replaceAll('+ 7', '+ 8'), {}, { timeout: 50 });
    return { originalValid: true, status: original === recovered ? 'MATCH' : 'MISMATCH', failureKind: 'trace', original, recovered };
  } catch (error) {
    return { originalValid: false, status: 'INVALID_ORIGINAL', failureKind: /timed out/.test(error.message) ? 'timeout' : 'syntax' };
  }
}

test('reducer preserves an executed trace mismatch while removing unrelated statements', async () => {
  const source = 'let unused = 900;\nlet extra = 100;\n3 + 7;\n';
  const result = await reduceSource({ source, observe: observeArithmetic, maxAttempts: 30 });
  assert.ok(result.source.length < source.length);
  assert.equal(observeArithmetic(result.source).status, 'MISMATCH');
  assert.equal(result.signature, 'MISMATCH:trace');
  assert.ok(result.attempts <= 30);
  assert.ok(result.accepted > 0);
  assert.equal(result.finalObservation.originalValid, true);
});

test('reducer does not turn invalid originals, timeouts, or other failure kinds into a reproducer', async () => {
  assert.equal(failureSignature({ originalValid: false, status: 'MISMATCH', failureKind: 'trace' }), null);
  assert.equal(failureSignature({ originalValid: true, status: 'MISMATCH', failureKind: 'timeout' }), null);
  assert.equal(failureSignature({ originalValid: true, status: 'NOT_MEASURED', failureKind: 'timeout' }), null);
  await assert.rejects(reduceSource({ source: 'let = ;', observe: observeArithmetic, maxAttempts: 10 }), /reducible/);
  let calls = 0;
  const result = await reduceSource({
    source: 'first\nsecond\nthird\n', maxAttempts: 4,
    observe(source) {
      calls++;
      return { originalValid: true, status: 'MISMATCH', failureKind: source.includes('first\nsecond\nthird') ? 'trace' : 'runtime-error' };
    },
  });
  assert.equal(result.source, 'first\nsecond\nthird\n');
  assert.equal(result.accepted, 0);
  assert.ok(calls <= 4);
  assert.equal(result.attempts, calls);
});
