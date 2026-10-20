import { test } from "node:test";
import assert from "node:assert/strict";
import { compareTraces, CONTROLLED_CASES, CONTROLLED_OPTIMIZATIONS, VERIFIED_BASELINE } from "./bench-semantic.mjs";

const run = (stdout, stderr = "") => ({
  ok: true, status: 0, signal: null, stdout, stderr, error: null,
});

test("semantic corpus is a fixed allowlist of owned Luau sources", () => {
  assert.deepEqual(CONTROLLED_CASES, ["arithmetic", "branches", "loop", "closure", "tables", "multireturn", "nestedloops", "recursion"]);
});

test("CI gates only behavior already independently verified, without treating new failures as passes", () => {
  assert.equal(VERIFIED_BASELINE.length, 16);
  assert.equal(new Set(VERIFIED_BASELINE).size, 16);
  for (const id of CONTROLLED_CASES) {
    assert.ok(VERIFIED_BASELINE.includes(id));
    assert.ok(VERIFIED_BASELINE.includes(`${id}@O1`));
  }
  for (const caseId of ["tables", "multireturn", "nestedloops", "recursion"]) {
    assert.ok(VERIFIED_BASELINE.includes(caseId), "officially validated fixture must remain a CI gate");
  }
});

test("optimization matrix gates all 16 officially confirmed O0/O1 cases", () => {
  assert.deepEqual(CONTROLLED_OPTIMIZATIONS, [0, 1]);
  assert.equal(CONTROLLED_CASES.length * CONTROLLED_OPTIMIZATIONS.length, 16);
  assert.equal(VERIFIED_BASELINE.filter((id) => id.endsWith("@O1")).length, 8);
});

test("matches equal nonempty deterministic traces", () => {
  assert.deepEqual(compareTraces(run("result=15\n"), run("result=15\n")), { status: "MATCH" });
});

test("detects changed evaluation results and output ordering", () => {
  assert.equal(compareTraces(run("1\n2\n"), run("2\n1\n")).status, "MISMATCH");
  assert.equal(compareTraces(run("sum=15\n"), run("sum=16\n")).status, "MISMATCH");
  assert.equal(compareTraces(run("result\n"), run("result\n", "unexpected")).status, "MISMATCH");
});

test("does not count two empty outputs as a successful semantic comparison", () => {
  assert.deepEqual(compareTraces(run(""), run("")), {
    status: "ERROR", reason: "controlled fixture did not produce a trace",
  });
});

test("rejects either execution failure even when their output matches", () => {
  assert.equal(compareTraces({ ...run("same"), ok: false, status: 1 }, run("same")).status, "ERROR");
  assert.equal(compareTraces(run("same"), { ...run("same"), ok: false, signal: "SIGTERM" }).status, "ERROR");
});
