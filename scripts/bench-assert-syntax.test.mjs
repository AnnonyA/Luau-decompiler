import { test } from "node:test";
import assert from "node:assert/strict";
import { inspectSyntaxReport } from "./bench-assert-syntax.mjs";

function report(status = "PASS", published = "PASS") {
  return {
    schemaVersion: 1,
    compiler: { executable: "/tmp/luau-compile", mode: "--only-parse --null" },
    samples: [{
      id: "lunaux/Sample",
      ourEngine: { success: true, syntax: { status } },
      competitorPublishedSource: { available: true, syntax: { status: published } },
    }],
  };
}

test("accepts genuine successful parser results from both published and own source", () => {
  assert.deepEqual(inspectSyntaxReport(report()), {
    checked: 1,
    own: { PASS: 1, FAIL: 0 },
    published: { PASS: 1, FAIL: 0 },
  });
});

test("records actual syntax failure as a measured result rather than inventing PASS", () => {
  assert.deepEqual(inspectSyntaxReport(report("FAIL", "PASS")).own, { PASS: 0, FAIL: 1 });
  assert.deepEqual(inspectSyntaxReport(report("PASS", "FAIL")).published, { PASS: 0, FAIL: 1 });
});

test("requireAllPass makes syntax failures a blocking, diagnosed regression", () => {
  assert.deepEqual(inspectSyntaxReport(report(), { requireAllPass: true }).own, { PASS: 1, FAIL: 0 });
  assert.throws(
    () => inspectSyntaxReport(report("FAIL"), { requireAllPass: true }),
    /official Luau parser rejected 1\/1 decompiled sources: lunaux\/Sample/,
  );
  // Competitor-published syntax failures are diagnostic and do not block our output gate.
  assert.equal(inspectSyntaxReport(report("PASS", "FAIL"), { requireAllPass: true }).own.PASS, 1);
});

test("rejects missing, skipped, or errored official compiler invocation", () => {
  for (const state of ["NOT_CHECKED", "ERROR", undefined]) {
    const own = report();
    own.samples[0].ourEngine.syntax.status = state;
    assert.throws(() => inspectSyntaxReport(own), /parser did not complete/);
    const published = report();
    published.samples[0].competitorPublishedSource.syntax.status = state;
    assert.throws(() => inspectSyntaxReport(published), /published reference/);
  }
  const missing = report();
  missing.compiler = "NOT_CONFIGURED";
  assert.throws(() => inspectSyntaxReport(missing), /does not identify official parser execution/);
});

test("rejects failed decompilation and empty corpus instead of recording false success", () => {
  const failed = report();
  failed.samples[0].ourEngine.success = false;
  assert.throws(() => inspectSyntaxReport(failed), /decompiler failed/);
  const empty = report();
  empty.samples = [];
  assert.throws(() => inspectSyntaxReport(empty), /empty parser report/);
});
