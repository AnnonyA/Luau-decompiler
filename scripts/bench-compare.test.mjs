import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectFixtures, runBenchmark, sourceMetrics, syntaxCheck } from "./bench-compare.mjs";

test("manifest includes the three existing real bytecode fixtures", async () => {
  const fixtures = await collectFixtures();
  assert.deepEqual(fixtures.map((fixture) => fixture.id), [
    "luac", "index-ui", "military-controller",
  ]);
});

test("source metrics are deterministic and identify explicit register placeholders", () => {
  assert.deepEqual(sourceMetrics("local r2 = up3\nreturn r2\n"), {
    bytes: 27,
    lines: 2,
    registerPlaceholders: 3,
  });
});

test("a syntax check is not claimed when official compiler is unavailable", async () => {
  assert.deepEqual(await syntaxCheck("return 1"), { status: "NOT_CHECKED" });
  const checked = await syntaxCheck("return 1", "/this/compiler/does/not/exist");
  assert.equal(checked.status, "ERROR");
});

test("own benchmark records hashes, versions, evidence limits and result counts", async () => {
  const report = await runBenchmark();
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.fixtureCounts.repository, 3);
  assert.equal(report.fixtureCounts.lunaux, 0);
  assert.equal(report.fixtureCounts.total, 3);
  assert.equal(report.fixtureCounts.successful, 3);
  for (const sample of report.samples) {
    assert.match(sample.sha256, /^[a-f0-9]{64}$/);
    assert.ok(sample.inputBytes > 0);
    assert.ok(sample.ourEngine.durationMs >= 0);
    assert.equal(sample.semanticEquivalence, "NOT_MEASURED");
    assert.equal(sample.competitorExecution, "NOT_RUN");
    assert.equal(sample.ourEngine.syntax.status, "NOT_CHECKED");
  }
});

test("optional LunaUX clone is measured as input files, never as timed competitor execution", async () => {
  const dir = await mkdtemp(join(tmpdir(), "luau-lunaux-fixture-"));
  try {
    await mkdir(join(dir, "Tests", "Binary"), { recursive: true });
    await mkdir(join(dir, "Tests", "Decompile"), { recursive: true });
    const input = await readFile(new URL("../tests/luac.bin", import.meta.url));
    await writeFile(join(dir, "Tests", "Binary", "Sample.luauc"), input);
    await writeFile(join(dir, "Tests", "Decompile", "Sample.luau"), "return 1\n");
    const fixtures = await collectFixtures({ lunauxDir: dir });
    assert.equal(fixtures.length, 4);
    assert.equal(fixtures[3].id, "lunaux/Sample");
    const report = await runBenchmark({ lunauxDir: dir });
    assert.equal(report.fixtureCounts.lunaux, 1);
    const sample = report.samples.at(-1);
    assert.equal(sample.competitorPublishedSource.available, true);
    assert.equal(sample.competitorPublishedSource.syntax.status, "NOT_CHECKED");
    assert.equal(sample.competitorExecution, "NOT_RUN");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
