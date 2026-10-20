#!/usr/bin/env node
/**
 * Reproducible measurement harness, not a claim of semantic equivalence.
 * Run after npm run build. No user-provided bytecode is ever executed.
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { decompile } from "../dist/decompile.js";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const DEFAULT_MANIFEST = join(ROOT, "benchmarks/corpus.json");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

export function sourceMetrics(source) {
  return {
    bytes: Buffer.byteLength(source),
    lines: source.split("\n").length - Number(source.endsWith("\n")),
    registerPlaceholders: (source.match(/\b(?:r\d+|up\d+)\b/g) ?? []).length,
  };
}

/**
 * Only an explicit official Luau executable establishes syntax validity.
 * "NOT_CHECKED" is intentionally distinct from true.
 */
export async function syntaxCheck(source, compiler) {
  if (!compiler) return { status: "NOT_CHECKED" };
  const dir = await mkdtemp(join(tmpdir(), "luau-bench-"));
  const file = join(dir, "candidate.luau");
  try {
    await writeFile(file, source, "utf8");
    const run = spawnSync(compiler, ["--only-parse", "--null", file], {
      encoding: "utf8", timeout: 20000, maxBuffer: 1024 * 1024,
    });
    if (run.error) return { status: "ERROR", reason: run.error.message };
    return {
      status: run.status === 0 ? "PASS" : "FAIL",
      ...(run.status === 0 ? {} : { reason: String(run.stderr || run.stdout).slice(0, 1000) }),
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function collectFixtures({ manifest = DEFAULT_MANIFEST, lunauxDir } = {}) {
  const parsed = JSON.parse(await readFile(manifest, "utf8"));
  if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.fixtures)) {
    throw new Error("unsupported benchmark manifest schema");
  }
  const fixtures = parsed.fixtures.map((entry) => ({
    id: entry.id,
    group: "repository",
    path: resolve(dirname(manifest), "..", entry.bytecode),
    provenance: entry.provenance,
  }));
  if (lunauxDir) {
    const binDir = join(lunauxDir, "Tests", "Binary");
    const entries = (await readdir(binDir)).filter((name) => name.endsWith(".luauc")).sort();
    for (const name of entries) {
      const id = name.slice(0, -".luauc".length);
      fixtures.push({
        id: "lunaux/" + id,
        group: "lunaux",
        path: join(binDir, name),
        provenance: "boydev-1444/lunaux-decompiler Tests/Binary at user checkout",
        reference: join(lunauxDir, "Tests", "Decompile", id + ".luau"),
      });
    }
  }
  const ids = new Set();
  for (const fixture of fixtures) {
    if (typeof fixture.id !== "string" || typeof fixture.path !== "string" || ids.has(fixture.id)) {
      throw new Error("invalid or repeated benchmark fixture identifier");
    }
    ids.add(fixture.id);
  }
  return fixtures;
}

export async function runBenchmark({ manifest, lunauxDir, compiler, engine = decompile } = {}) {
  const fixtures = await collectFixtures({ manifest, lunauxDir });
  const packageMetadata = JSON.parse(await readFile(join(ROOT, "package.json"), "utf8"));
  const samples = [];
  for (const fixture of fixtures) {
    const bytes = await readFile(fixture.path);
    const started = process.hrtime.bigint();
    let result;
    try {
      result = engine(new Uint8Array(bytes));
    } catch (error) {
      result = { ok: false, code: "unexpected", error: String(error) };
    }
    const durationMs = Math.round(Number(process.hrtime.bigint() - started) / 1000) / 1000;
    const entry = {
      id: fixture.id,
      group: fixture.group,
      provenance: fixture.provenance,
      sha256: sha256(bytes),
      inputBytes: bytes.length,
      ourEngine: {
        success: result.ok,
        durationMs,
        ...(result.ok
          ? {
              bytecodeVersion: result.module.version,
              supportStatus: result.profile.status,
              astValidationIssues: result.validation.length,
              syntax: await syntaxCheck(result.source, compiler),
              sourceMetrics: sourceMetrics(result.source),
            }
          : { errorCode: result.code, error: result.error }),
      },
      semanticEquivalence: "NOT_MEASURED",
      competitorExecution: "NOT_RUN",
    };
    if (fixture.reference) {
      try {
        const reference = await readFile(fixture.reference, "utf8");
        entry.competitorPublishedSource = {
          available: true,
          sha256: sha256(Buffer.from(reference)),
          sourceMetrics: sourceMetrics(reference),
          syntax: await syntaxCheck(reference, compiler),
          note: "Published artifact only: no competitor engine was timed or executed",
        };
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
        entry.competitorPublishedSource = { available: false, syntax: { status: "NOT_CHECKED" } };
      }
    }
    samples.push(entry);
  }
  return {
    schemaVersion: 1,
    measuredAt: new Date().toISOString(),
    localEngine: "AnnonyA/Luau-decompiler",
    localVersion: packageMetadata.version,
    compiler: compiler ? { executable: compiler, mode: "--only-parse --null" } : "NOT_CONFIGURED",
    platform: { node: process.version, platform: process.platform, arch: process.arch },
    comparisonNote: "Only our engine is executed/timed; LunaUX published source is not an independently measured engine result. Syntax is NOT_CHECKED without official luau-compile. Semantic equivalence is NOT_MEASURED.",
    fixtureCounts: {
      total: samples.length,
      repository: samples.filter((s) => s.group === "repository").length,
      lunaux: samples.filter((s) => s.group === "lunaux").length,
      successful: samples.filter((s) => s.ourEngine.success).length,
    },
    processPeakRssBytes: process.memoryUsage().rss,
    samples,
  };
}

function parseOptions(args) {
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (!["--manifest", "--lunaux-dir", "--luau-compile", "--output", "--require-lunaux-count"].includes(key)) {
      throw new Error("unknown argument " + key);
    }
    const value = args[++i];
    if (!value || value.startsWith("--")) throw new Error("missing value for " + key);
    if (key === "--manifest") out.manifest = resolve(value);
    if (key === "--lunaux-dir") out.lunauxDir = resolve(value);
    if (key === "--luau-compile") out.compiler = resolve(value);
    if (key === "--output") out.output = resolve(value);
    if (key === "--require-lunaux-count") out.requireLunauxCount = Number(value);
  }
  return out;
}

async function main() {
  const { output, requireLunauxCount, ...options } = parseOptions(process.argv.slice(2));
  const result = await runBenchmark(options);
  if (requireLunauxCount !== undefined && result.fixtureCounts.lunaux !== requireLunauxCount) {
    throw new Error("expected " + requireLunauxCount + " LunaUX fixtures, found " + result.fixtureCounts.lunaux);
  }
  const report = JSON.stringify(result, null, 2) + "\n";
  if (output) {
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, report);
    process.stdout.write("Benchmark report saved to " + output + "\n");
  } else {
    process.stdout.write(report);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(String(error instanceof Error ? error.message : error) + "\n");
    process.exitCode = 1;
  });
}
