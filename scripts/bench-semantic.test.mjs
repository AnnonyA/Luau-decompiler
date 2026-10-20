import { test } from "node:test";
import assert from "node:assert/strict";
import { compareTraces, CONTROLLED_CASES, VERIFIED_BASELINE } from "./bench-semantic.mjs";

const run = (stdout, stderr = "") => ({
  ok: true, status: 0, signal: null, stdout, stderr, error: null,
});

test("semantic corpus is a fixed allowlist of owned Luau sources", () => {
  assert.deepEqual(CONTROLLED_CASES, ["arithmetic", "branches", "loop", "closure"]);
});

test("CI gates only behavior already independently verified, without treating new failures as passes", () => {
  assert.deepEqual(VERIFIED_BASELINE, ["arithmetic", "branches", "loop", "closure"]);
  assert.ok(VERIFIED_BASELINE.every((id) => CONTROLLED_CASES.includes(id)));
  assert.ok(CONTROLLED_CASES.includes("loop"));
  assert.ok(VERIFIED_BASELINE.includes("loop"));
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
