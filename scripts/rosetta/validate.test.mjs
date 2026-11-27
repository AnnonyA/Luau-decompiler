import assert from "node:assert/strict";
import { test } from "node:test";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertComparableEnvironment, decompilerCommand, parseArgs, runTier } from "../bench-rosetta.mjs";
import { inventoryHash, suite, tierNames, validateResult, validateResultText } from "./validate.mjs";

function recount(result) {
  const totals = {};
  result.score = { passed: 0, total: 0 };
  for (const section of result.sections) {
    section.score = { passed: 0, total: 0 };
    for (const test of section.tests) {
      for (const letter of test.results) {
        const verdict = suite.letters[letter];
        totals[verdict] = (totals[verdict] ?? 0) + 1;
        if (letter !== "u") section.score.total++;
        if (letter === "p") section.score.passed++;
      }
    }
    result.score.passed += section.score.passed;
    result.score.total += section.score.total;
  }
  result.totals = totals;
  return result;
}

function fixture(tier = "quick") {
  const config = suite.tiers[tier];
  const excluded = new Set(config.unusable.map((entry) => `${entry.section}/${entry.test}`));
  return recount({
    format: "rosetta-result", schema: 1, rosetta: "0.1.0", luau: "0.747",
    suite: { name: "rosetta-3", tier, hash: config.hash },
    decompiler: { name: suite.decompiler, version: "test-engine-revision" },
    created: "2026-11-27T00:00:00Z", seconds: 1, threads: 2,
    profiles: config.profiles, letters: suite.letters,
    sections: config.sections.map((section) => ({
      id: section.id,
      tests: suite.inventories[section.inventory].names.map((name) => {
        const unusable = excluded.has(`${section.id}/${name}`);
        return {
          name,
          results: (unusable ? "u" : "p").repeat(config.profiles.length),
          ...(unusable ? { details: Object.fromEntries(config.profiles.map((profile) => [profile, "input exhausts the step budget"])) } : {}),
        };
      }),
    })),
  });
}

function changeVerdict(result, letter, { section = 0, program = 0, profile = 0 } = {}) {
  const item = result.sections[section].tests[program];
  item.results = [...item.results].map((previous, index) => index === profile ? letter : previous).join("");
  item.details ??= {};
  if (letter === "p") delete item.details[result.profiles[profile]];
  else item.details[result.profiles[profile]] = `observed ${suite.letters[letter]}`;
  return recount(result);
}

test("the committed pin records all four published suite fingerprints and full corpus inventories", () => {
  assert.equal(suite.revision, "80f3c13ce48dc3318d5d49f54958f580937ca8aa");
  assert.deepEqual(tierNames.map((tier) => suite.tiers[tier].hash), ["e24826907050bd1d", "f0eae8ffcedd440e", "9bcb49d29e867a92", "9921d3bde4a99bfd"]);
  assert.deepEqual(tierNames.map((tier) => suite.tiers[tier].usable), [882, 12276, 882, 12276]);
  for (const inventory of Object.values(suite.inventories)) {
    assert.equal(inventoryHash(inventory.names), inventory.sha256);
    assert.equal(new Set(inventory.names).size, inventory.names.length);
  }
});

for (const tier of tierNames) {
  test(`${tier}: reconstructs the complete all-pass result, preserving only pinned unusable originals`, () => {
    const result = fixture(tier);
    const summary = validateResult(result, { tier, expectedVersion: "test-engine-revision" });
    assert.equal(summary.allPass, true);
    assert.equal(summary.passed, suite.tiers[tier].usable);
    assert.equal(summary.roundTrips, suite.tiers[tier].roundTrips);
    assert.equal(summary.counts.unusable, tier.endsWith("full") ? 6 : 0);
  });
}

test("rejects malformed JSON and unsupported metadata, versions, profile order and verdict mapping", () => {
  assert.throws(() => validateResultText('{"format":'), /malformed JSON/);
  const cases = [
    [(r) => { r.schema = 2; }, /format\/schema/],
    [(r) => { r.luau = "0.746"; }, /luau/],
    [(r) => { r.suite.name = "rosetta-2"; }, /suite.name/],
    [(r) => { r.suite.hash = "0000000000000000"; }, /suite.hash/],
    [(r) => { r.profiles = [...r.profiles].reverse(); }, /profile list/],
    [(r) => { r.letters = { ...r.letters, r: "pass" }; }, /letter r/],
    [(r) => { r.decompiler.name = "someone-else"; }, /decompiler.name/],
    [(r) => { delete r.decompiler.version; }, /decompiler.version/],
    [(r) => { r.seconds = NaN; }, /seconds/],
    [(r) => { r.threads = 0; }, /threads/],
  ];
  for (const [tamper, pattern] of cases) {
    const result = fixture();
    tamper(result);
    assert.throws(() => validateResult(result), pattern);
  }
  assert.throws(() => validateResult(fixture(), { expectedVersion: "different-build" }), /engine revision/);
  assert.throws(() => validateResult(fixture(), { tier: "full" }), /suite.tier/);
});

test("a self-consistent smaller corpus, duplicate or substituted case cannot pass", () => {
  const missing = fixture();
  missing.sections[0].tests.pop();
  recount(missing);
  assert.throws(() => validateResult(missing), /all 41 pinned programs/);
  const duplicate = fixture();
  duplicate.sections[0].tests[0].name = duplicate.sections[0].tests[1].name;
  assert.throws(() => validateResult(duplicate), /duplicate program/);
  const substituted = fixture();
  substituted.sections[2].tests[0].name = "not-a-pinned-seed";
  assert.throws(() => validateResult(substituted), /inventory/);
  const absentSection = fixture();
  absentSection.sections.splice(1, 1);
  recount(absentSection);
  assert.throws(() => validateResult(absentSection), /section list/);
});

test("rejects inflated or understated scores and totals, even when a process reported success", () => {
  const mutations = [
    [(r) => { r.score.passed--; }, /score.passed/],
    [(r) => { r.score.total++; }, /score.total/],
    [(r) => { r.sections[1].score.passed--; }, /libraries.score.passed/],
    [(r) => { r.totals.pass--; }, /totals.pass/],
    [(r) => { r.totals.mismatch = 1; }, /totals.mismatch/],
    [(r) => { r.totals.invented = 1; }, /unknown verdict/],
    [(r) => { r.score.passed = "882"; }, /safe integer/],
  ];
  for (const [mutate, pattern] of mutations) {
    const result = fixture();
    mutate(result);
    assert.throws(() => validateResult(result), pattern);
  }
  const hiddenMismatch = changeVerdict(fixture(), "w");
  hiddenMismatch.score.passed++;
  assert.throws(() => validateResult(hiddenMismatch, { requireAllPass: false }), /score.passed/);
});

test("refusals, recompilation failures, crashes and mismatches all fail the default gate", () => {
  for (const letter of ["r", "c", "f", "w"]) {
    const result = changeVerdict(fixture(), letter);
    assert.throws(() => validateResult(result), /all-pass gate failed: 881\/882/);
    const measured = validateResult(result, { requireAllPass: false });
    assert.equal(measured.allPass, false);
    assert.equal(measured.counts[suite.letters[letter]], 1);
    assert.equal(measured.passed, 881);
  }
});

test("a changed unusable-original exclusion cannot hide a failure or reduce the denominator", () => {
  assert.throws(() => validateResult(changeVerdict(fixture(), "u"), { requireAllPass: false }), /unusable-original/);
  const full = fixture("full");
  const excludedIndex = full.sections[2].tests.findIndex((item) => item.name === "seed1541");
  changeVerdict(full, "p", { section: 2, program: excludedIndex });
  changeVerdict(full, "u", { section: 2, program: 0 });
  assert.equal(full.totals.unusable, 6);
  assert.equal(full.score.total, 12276);
  assert.throws(() => validateResult(full, { requireAllPass: false }), /unusable-original/);
});

test("validates every profile letter and its corresponding failure detail", () => {
  const missingProfile = fixture();
  missingProfile.sections[0].tests[0].results = "ppppp";
  assert.throws(() => validateResult(missingProfile), /one verdict per profile/);
  const badLetter = fixture();
  badLetter.sections[0].tests[0].results = "pppppx";
  assert.throws(() => validateResult(badLetter), /unknown verdict letter/);
  const missingDetail = changeVerdict(fixture(), "w");
  delete missingDetail.sections[0].tests[0].details;
  assert.throws(() => validateResult(missingDetail, { requireAllPass: false }), /details must describe/);
  const hiddenDetail = fixture();
  hiddenDetail.sections[0].tests[0].details = { O0g1: "mismatch hidden behind p" };
  assert.throws(() => validateResult(hiddenDetail), /details must describe/);
});

test("comparable measurement rejects semantic overrides, including explicitly empty variables", () => {
  assert.doesNotThrow(() => assertComparableEnvironment({ PATH: "/usr/bin" }));
  for (const name of ["ROSETTA_TRANSFORM_OFF", "ROSETTA_TRANSFORM_ONLY", "LUAU_DECOMPILE_OPTS"]) {
    for (const value of ["", "anything"]) assert.throws(() => assertComparableEnvironment({ [name]: value }), new RegExp(name));
  }
});

test("the direct CLI command never relies on shell quoting and the runner rejects unknown switches", () => {
  assert.equal(decompilerCommand("/usr/bin/node", "/engine/dist/cli.js"), "/usr/bin/node /engine/dist/cli.js decompile {}");
  for (const path of ["/path with spaces/node", "/path\tname/node", "/path/{}/node"]) {
    assert.throws(() => decompilerCommand(path, "/engine/dist/cli.js"), /cannot represent/);
    assert.throws(() => decompilerCommand("/usr/bin/node", path), /cannot represent/);
  }
  assert.equal(parseArgs(["--rosetta-dir", "/tmp/rosetta", "--tier", "all", "--measure-only"]).measureOnly, true);
  assert.throws(() => parseArgs(["--rosetta-dir", "/tmp/rosetta", "--tier", "invented"]), /--tier/);
  assert.throws(() => parseArgs(["--rosetta-dir", "/tmp/rosetta", "--threads", "0"]), /positive integer/);
  assert.throws(() => parseArgs(["--rosetta-dir", "/tmp/rosetta", "--allow-missing"]), /Unknown argument/);
});

function withFakeBenchmark(t, result, exitCode = 0) {
  const directory = mkdtempSync(join(tmpdir(), "rosetta-runner-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const fixturePath = join(directory, "fixture.json");
  writeFileSync(fixturePath, JSON.stringify(result));
  const executable = join(directory, "rosetta");
  writeFileSync(executable, `#!${process.execPath}\nconst fs = require('node:fs');\nconst path = require('node:path');\nconst out = process.argv[process.argv.indexOf('--out') + 1];\nfs.copyFileSync(${JSON.stringify(fixturePath)}, path.join(out, 'annonyA-quick.json'));\nprocess.exitCode = ${exitCode};\n`);
  chmodSync(executable, 0o755);
  return {
    tier: "quick", out: join(directory, "results"), binary: executable,
    command: "/unused/direct-cli {}", version: "test-engine-revision", threads: 1,
    gallery: false, measureOnly: false, environment: {},
    provenance: { engine: { revision: "test-engine-revision" }, rosetta: { checkout: directory } },
    stdio: "ignore",
  };
}

test("a real subprocess exiting zero with a failing result fails the gate and preserves evidence", (t) => {
  const result = changeVerdict(fixture(), "w");
  const options = withFakeBenchmark(t, result);
  const run = runTier(options);
  assert.equal(run.ok, false);
  assert.equal(run.record.process.exitCode, 0);
  assert.equal(run.record.summary.passed, 881);
  assert.equal(run.record.status, "failed");
  assert.match(run.record.error, /all-pass gate failed/);
  assert.match(run.record.result.sha256, /^[0-9a-f]{64}$/);
  assert.deepEqual(JSON.parse(readFileSync(run.record.result.path, "utf8")), result);
  assert.deepEqual(JSON.parse(readFileSync(run.provenancePath, "utf8")), run.record);
  assert.throws(() => runTier(options), /Refusing to replace existing evidence/);
});

test("measurement-only preserves failures, but still rejects inconsistent JSON", (t) => {
  const valid = withFakeBenchmark(t, changeVerdict(fixture(), "r"));
  const run = runTier({ ...valid, measureOnly: true });
  assert.equal(run.ok, true);
  assert.equal(run.record.summary.allPass, false);
  assert.equal(run.record.gate, "measurement-only");
  const malformed = fixture();
  malformed.score.passed--;
  const invalid = runTier({ ...withFakeBenchmark(t, malformed), measureOnly: true });
  assert.equal(invalid.ok, false);
  assert.match(invalid.record.error, /score.passed/);
});

test("a nonzero process exit cannot pass, even when it left a complete all-pass JSON", (t) => {
  const run = runTier(withFakeBenchmark(t, fixture(), 2));
  assert.equal(run.ok, false);
  assert.equal(run.record.process.exitCode, 2);
  assert.match(run.record.error, /process failed/);
  assert.match(run.record.result.sha256, /^[0-9a-f]{64}$/);
});

test("engine changes during measurement invalidate otherwise passing results", (t) => {
  const run = runTier({ ...withFakeBenchmark(t, fixture()), verifyUnchanged() { throw new Error("Engine changed during measurement"); } });
  assert.equal(run.ok, false);
  assert.match(run.record.error, /changed during measurement/);
});
