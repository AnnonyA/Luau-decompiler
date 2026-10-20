import { test } from "node:test";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectFixtures, runBenchmark, sourceMetrics, syntaxCheck, verifyLunauxCheckout } from "./bench-compare.mjs";

test("manifest includes the three existing real bytecode fixtures", async () => {
  const fixtures = await collectFixtures();
  assert.deepEqual(fixtures.map((fixture) => fixture.id), [
    "luac", "index-ui", "military-controller",
  ]);
});

test("an opt-in source directory contains the reconstructed fixtures for diagnosis", async () => {
  const dir = await mkdtemp(join(tmpdir(), "luau-source-diagnostic-"));
  try {
    const report = await runBenchmark({ sourceDir: dir });
    assert.equal(report.fixtureCounts.repository, 3);
    const emitted = await readFile(join(dir, "luac.luau"), "utf8");
    assert.match(emitted, /Callable/);
    assert.match(emitted, /\\(\"Callable\\(calls=%\\*\\)\"\\):format/);
    assert.match(await readFile(join(dir, "index-ui.luau"), "utf8"), /\\(\"Role: %\\*\"\\):format/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("source metrics are deterministic and identify explicit register placeholders", () => {
  assert.deepEqual(sourceMetrics("local r2 = up3\nreturn r2\n"), {
    bytes: 25,
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


const gitBlob = (data) =>
  createHash("sha1").update("blob " + data.length + "\0").update(data).digest("hex");

async function setupPinnedClone() {
  const dir = await mkdtemp(join(tmpdir(), "luau-lunaux-fixture-"));
  await mkdir(join(dir, "Tests", "Binary"), { recursive: true });
  await mkdir(join(dir, "Tests", "Decompile"), { recursive: true });
  const binary = await readFile(new URL("../tests/luac.bin", import.meta.url));
  const output = Buffer.from("return 1\n", "utf8");
  const fixtures = [];
  for (let i = 1; i <= 22; i++) {
    const base = "Sample" + String(i).padStart(2, "0");
    await writeFile(join(dir, "Tests", "Binary", base + ".luauc"), binary);
    await writeFile(join(dir, "Tests", "Decompile", base + ".luau"), output);
    fixtures.push({
      name: base + ".luauc",
      binary: { bytes: binary.length, gitBlobSha1: gitBlob(binary) },
      reference: { bytes: output.length, gitBlobSha1: gitBlob(output) },
    });
  }
  const lockPath = join(dir, "lock.json");
  await writeFile(lockPath, JSON.stringify({
    schemaVersion: 1,
    repository: "boydev-1444/lunaux-decompiler",
    revision: "a".repeat(40),
    fixtures,
  }));
  return { dir, lockPath };
}

test("pinned LunaUX clone is measured without claiming competitor execution", async () => {
  const { dir, lockPath } = await setupPinnedClone();
  try {
    const fixtures = await collectFixtures({ lunauxDir: dir, lunauxLock: lockPath });
    assert.equal(fixtures.length, 25);
    assert.equal(fixtures[3].id, "lunaux/Sample01");
    const report = await runBenchmark({ lunauxDir: dir, lunauxLock: lockPath });
    assert.equal(report.fixtureCounts.lunaux, 22);
    const sample = report.samples.at(-1);
    assert.equal(sample.competitorPublishedSource.available, true);
    assert.equal(sample.competitorPublishedSource.syntax.status, "NOT_CHECKED");
    assert.equal(sample.competitorExecution, "NOT_RUN");
    assert.match(sample.provenance, /@a{40}/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("pinned corpus verification rejects modified binary content", async () => {
  const { dir, lockPath } = await setupPinnedClone();
  try {
    const path = join(dir, "Tests", "Binary", "Sample01.luauc");
    const bytes = await readFile(path);
    bytes[2] ^= 0x80;
    await writeFile(path, bytes);
    await assert.rejects(() => verifyLunauxCheckout(dir, lockPath), /integrity check failed.*Sample01/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("pinned corpus verification rejects modified competitor source", async () => {
  const { dir, lockPath } = await setupPinnedClone();
  try {
    await writeFile(join(dir, "Tests", "Decompile", "Sample01.luau"), "return 2\n");
    await assert.rejects(() => verifyLunauxCheckout(dir, lockPath), /integrity check failed.*Sample01/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("pinned corpus verification rejects missing or extra samples", async () => {
  const { dir, lockPath } = await setupPinnedClone();
  try {
    await writeFile(join(dir, "Tests", "Binary", "Unexpected.luauc"), "extra");
    await assert.rejects(() => verifyLunauxCheckout(dir, lockPath), /fixture set mismatch/);
    await rm(join(dir, "Tests", "Binary", "Unexpected.luauc"));
    await rm(join(dir, "Tests", "Binary", "Sample01.luauc"));
    await assert.rejects(() => verifyLunauxCheckout(dir, lockPath), /fixture set mismatch/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
