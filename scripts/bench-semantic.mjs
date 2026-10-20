#!/usr/bin/env node
/**
 * Controlled behavioral differential for project-owned Luau source fixtures.
 * This does NOT establish full program equivalence or compare with LunaUX.
 * It invokes a pinned official luau-compile and luau interpreter supplied by CI.
 * Never use this runner on third-party or user-supplied bytecode.
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { decompile } from "../dist/decompile.js";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
export const CONTROLLED_CASES = Object.freeze([
  "arithmetic", "branches", "loop", "closure",
]);
const digest = (data) => createHash("sha256").update(data).digest("hex");

function launch(program, args, cwd) {
  const result = spawnSync(program, args, {
    cwd,
    timeout: 15000,
    maxBuffer: 1024 * 1024,
    encoding: null,
    env: { PATH: process.env.PATH ?? "" },
  });
  return {
    ok: result.status === 0 && !result.error && !result.signal,
    status: result.status,
    signal: result.signal ?? null,
    stdout: result.stdout?.toString("utf8") ?? "",
    stderr: result.stderr?.toString("utf8") ?? "",
    error: result.error?.message ?? null,
  };
}

export function compareTraces(original, reconstructed) {
  if (!original.ok || !reconstructed.ok) {
    return { status: "ERROR", reason: "one or both Luau executions failed" };
  }
  if (!original.stdout) {
    return { status: "ERROR", reason: "controlled fixture did not produce a trace" };
  }
  if (original.stdout !== reconstructed.stdout || original.stderr !== reconstructed.stderr) {
    return { status: "MISMATCH", reason: "observable stdout or stderr differs" };
  }
  return { status: "MATCH" };
}

export async function runSemanticBenchmark({
  compiler, interpreter, engine = decompile,
} = {}) {
  if (!compiler || !interpreter) {
    throw new Error("both --luau-compile and --luau are required");
  }
  const tempDir = await mkdtemp(join(tmpdir(), "luau-semantic-"));
  const results = [];
  try {
    for (const id of CONTROLLED_CASES) {
      const originalPath = join(ROOT, "benchmarks", "semantic", id + ".luau");
      const originalSource = await readFile(originalPath, "utf8");
      const compiled = launch(compiler, ["--binary", "-O0", "-g1", originalPath], tempDir);
      if (!compiled.ok) {
        // Do not silently fall back to a hand-constructed bytecode fixture.
        throw new Error("official Luau compilation failed for " + id + ": " + compiled.stderr);
      }
      // Binary mode writes arbitrary bytes, not UTF-8 text: run the compiler
      // separately to obtain the actual buffer without string decoding.
      const binary = spawnSync(compiler, ["--binary", "-O0", "-g1", originalPath], {
        cwd: tempDir, timeout: 15000, maxBuffer: 1024 * 1024,
        env: { PATH: process.env.PATH ?? "" },
      });
      if (binary.error || binary.status !== 0 || !binary.stdout?.length) {
        throw new Error("missing official bytecode for " + id);
      }

      const bytecode = new Uint8Array(binary.stdout);
      const decompiled = engine(bytecode, { opcodeEncoding: "official" });
      let recoveredPath = null;
      let recoveredRun = null;
      if (decompiled.ok) {
        recoveredPath = join(tempDir, id + "-recovered.luau");
        await writeFile(recoveredPath, decompiled.source, "utf8");
      }
      const originalRun = launch(interpreter, [originalPath], tempDir);
      if (recoveredPath) recoveredRun = launch(interpreter, [recoveredPath], tempDir);
      const comparison = recoveredRun
        ? compareTraces(originalRun, recoveredRun)
        : { status: "ERROR", reason: "decompiler failed: " + decompiled.code };

      results.push({
        id,
        sourceSha256: digest(originalSource),
        binarySha256: digest(binary.stdout),
        bytecodeVersion: bytecode[0],
        recoveredSha256: decompiled.ok ? digest(decompiled.source) : null,
        reconstructionSucceeded: decompiled.ok,
        originalExecution: originalRun,
        reconstructedExecution: recoveredRun,
        comparison,
      });
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
  return {
    schemaVersion: 1,
    measuredAt: new Date().toISOString(),
    compiler: compiler,
    interpreter: interpreter,
    scope: "Controlled project-owned examples; compares stdout, stderr and exit success only. NOT full semantic equivalence.",
    total: results.length,
    match: results.filter((r) => r.comparison.status === "MATCH").length,
    mismatch: results.filter((r) => r.comparison.status === "MISMATCH").length,
    errors: results.filter((r) => r.comparison.status === "ERROR").length,
    results,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    const value = args[i + 1];
    if (!value || value.startsWith("--")) throw new Error("expected a value after " + args[i]);
    if (args[i] === "--luau-compile") options.compiler = resolve(value);
    else if (args[i] === "--luau") options.interpreter = resolve(value);
    else if (args[i] === "--output") options.output = resolve(value);
    else throw new Error("unexpected argument " + args[i]);
  }
  const { output, ...engineOptions } = options;
  const report = await runSemanticBenchmark(engineOptions);
  if (output) {
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, JSON.stringify(report, null, 2) + "\n");
  }
  process.stdout.write(
    "Controlled differential: " + report.match + "/" + report.total +
    " matching executions; mismatches=" + report.mismatch + "; errors=" + report.errors + "\n",
  );
  for (const item of report.results) {
    process.stdout.write(item.id + ": " + item.comparison.status + "\n");
  }
  if (report.match !== report.total || report.total !== CONTROLLED_CASES.length) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(String(error instanceof Error ? error.message : error) + "\n");
    process.exitCode = 1;
  });
}
