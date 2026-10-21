import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { compareTraces, CONTROLLED_CASES, CONTROLLED_OPTIMIZATIONS, VERIFIED_BASELINE } from "./bench-semantic.mjs";

const run = (stdout, stderr = "") => ({
  ok: true, status: 0, signal: null, stdout, stderr, error: null,
});

test("all 100 standalone source programs are distinct and included in the allowlist", async () => {
  const directory = new URL("../benchmarks/semantic/", import.meta.url);
  const files = (await readdir(directory)).filter((name) => name.endsWith(".luau")).sort();
  assert.equal(files.length, 100);
  assert.deepEqual(files, CONTROLLED_CASES.map((id) => id + ".luau").sort());
  const hashes = await Promise.all(files.map(async (file) =>
    createHash("sha256").update(await readFile(new URL(file, directory))).digest("hex")));
  assert.equal(new Set(hashes).size, 100, "copied source files must not inflate the program count");
});

test("semantic corpus is a fixed allowlist of owned Luau sources", () => {
  assert.deepEqual(CONTROLLED_CASES, ["arithmetic", "branches", "loop", "closure", "tables", "multireturn", "nestedloops", "recursion", "varargs", "shortcircuit", "mutablecaptures",
    "repeatbranch", "evaluationorder", "fixedresults", "openmethod", "concatorder", "booleancoercion", "returnbranches", "computednilkey", "concatsemantics", "formatsemantics",
    "arithsigns", "arithdivision", "arithmodulo", "arithpowers", "arithprecedence",
    "arithnegzero", "comparisonnan", "comparisonsmixed", "bitwiseops", "mathfunctions",
    "truthiness", "booleanreturn", "andorvalues", "chainedcomparisons", "elseifladder",
    "branchassignments", "earlyreturns", "nestedconditions", "nilchecks", "loopconditions",
    "forascending", "fordescending", "forsteps", "forboundaries", "whilezero",
    "repeatonce", "repeatlocals", "breakwhile", "continuefor", "repeatcontinue",
    "genericipairs", "genericpairs", "closuresnapshot", "closuremutations", "closuresiblings",
    "closureloop", "closurerecursive", "closurefactory", "closureshadow", "closureforward",
    "callbackarguments", "callbackreturn", "tableholes", "tablelisttail", "tablekeyorder",
    "tableoverwrite", "tablealias", "tabledelete", "tablelength", "tablesort",
    "tableclone", "tablefreeze", "callorder", "callnested", "callfixed",
    "callmultitail", "returnempty", "varargnil", "varargforward", "methodself",
    "methodmutate", "protectedcalls", "stringbinary", "stringbom", "stringcontrols",
    "stringunicode", "stringpatterns", "stringformatnumbers", "stringinterpolation", "stringconcatassoc",
    "stringnumbercoercion", "stringsubbytes", "localsreuse", "compoundread", "localtablesnapshot",
    "localfunctionbinding", "shadowmath", "shadowsglobals", "functionvaluefield"]);
});

test("CI gates all 200 behavior profiles verified by the pinned official VM", () => {
  assert.equal(VERIFIED_BASELINE.length, 200);
  assert.equal(new Set(VERIFIED_BASELINE).size, 200);
  for (const id of CONTROLLED_CASES) {
    assert.ok(VERIFIED_BASELINE.includes(id));
    assert.ok(VERIFIED_BASELINE.includes(`${id}@O1`));
  }
  for (const caseId of ["tables", "multireturn", "nestedloops", "recursion", "varargs", "mutablecaptures"]) {
    assert.ok(VERIFIED_BASELINE.includes(caseId), "officially validated fixture must remain a CI gate");
  }
});

test("optimization matrix gates all 200 confirmed pairs", () => {
  assert.deepEqual(CONTROLLED_OPTIMIZATIONS, [0, 1]);
  assert.equal(CONTROLLED_CASES.length * CONTROLLED_OPTIMIZATIONS.length, 200);
  assert.equal(VERIFIED_BASELINE.filter((id) => id.endsWith("@O1")).length, 100);
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
