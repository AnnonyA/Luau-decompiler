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
import { reconstructFunction } from "../dist/reconstruct/Reconstructor.js";
import { chunk } from "../dist/ast/Ast.js";
import { printLuau } from "../dist/print/LuauPrinter.js";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
// Keep previously confirmed cases blocking; new scenarios are diagnostic until
// independently observed in the pinned official VM on both optimization levels.
const VERIFIED_CASES = Object.freeze([
  "arithmetic", "branches", "loop", "closure",
  "tables", "multireturn", "nestedloops", "recursion", "varargs", "shortcircuit", "mutablecaptures",
  "repeatbranch", "evaluationorder", "fixedresults", "openmethod", "concatorder", "booleancoercion", "returnbranches", "computednilkey",
  "concatsemantics", "formatsemantics",
]);
export const CONTROLLED_CASES = Object.freeze([...VERIFIED_CASES]);
export const CONTROLLED_OPTIMIZATIONS = Object.freeze([0, 1]);
export const VERIFIED_BASELINE = Object.freeze([...VERIFIED_CASES, ...VERIFIED_CASES.map((id) => `${id}@O1`)]);
const digest = (data) => createHash("sha256").update(data).digest("hex");

function launch(program, args, cwd) {
  const result = spawnSync(program, args, {
    cwd,
    timeout: 3000,
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
      for (const optimization of CONTROLLED_OPTIMIZATIONS) {
      const caseId = optimization === 0 ? id : `${id}@O${optimization}`;
      // Capture raw bytes: Luau's --binary output is not UTF-8 text.
      const binary = spawnSync(compiler, ["--binary", `-O${optimization}`, "-g1", originalPath], {
        cwd: tempDir, timeout: 15000, maxBuffer: 1024 * 1024,
        env: { PATH: process.env.PATH ?? "" },
      });
      if (binary.error || binary.status !== 0 || !binary.stdout?.length) {
        throw new Error("official bytecode compilation failed for " + id + ": " + (binary.stderr?.toString("utf8") ?? binary.error?.message ?? "empty output"));
      }

      const bytecode = new Uint8Array(binary.stdout);
      let decompiled;
      try {
        decompiled = engine(bytecode, { opcodeEncoding: "official" });
      } catch (error) {
        decompiled = { ok: false, code: "unexpected", error: String(error) };
      }
      let recoveredPath = null;
      let recoveredRun = null;
      if (decompiled.ok) {
        recoveredPath = join(tempDir, caseId + "-recovered.luau");
        await writeFile(recoveredPath, decompiled.source, "utf8");
      }
      const originalRun = launch(interpreter, [originalPath], tempDir);
      if (recoveredPath) recoveredRun = launch(interpreter, [recoveredPath], tempDir);
      const comparison = recoveredRun
        ? compareTraces(originalRun, recoveredRun)
        : { status: "ERROR", reason: "decompiler failed: " + decompiled.code };

      results.push({
        id: caseId,
        sourceId: id,
        optimization,
        sourceSha256: digest(originalSource),
        binarySha256: digest(binary.stdout),
        bytecodeVersion: bytecode[0],
        recoveredSha256: decompiled.ok ? digest(decompiled.source) : null,
        // Only project-authored fixtures run here; preserve generated text
        // so a failing comparison can be reproduced without guesswork.
        recoveredSource: decompiled.ok ? decompiled.source : null,
        // Controlled fixtures only: retain the decoded register layout to
        // diagnose semantic aliasing without running arbitrary bytecode.
        disassembly: decompiled.ok ? decompiled.disassembly : null,
        rawSource: decompiled.ok
          ? printLuau(chunk(reconstructFunction(decompiled.module, decompiled.module.prototypes[decompiled.module.mainProtoId]).body.statements))
          : null,
        reconstructionSucceeded: decompiled.ok,
        originalExecution: originalRun,
        reconstructedExecution: recoveredRun,
        comparison,
      });
      }
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
    compilationProfiles: [...CONTROLLED_OPTIMIZATIONS].map((n) => `-O${n} -g1`),
    match: results.filter((r) => r.comparison.status === "MATCH").length,
    mismatch: results.filter((r) => r.comparison.status === "MISMATCH").length,
    errors: results.filter((r) => r.comparison.status === "ERROR").length,
    verifiedBaseline: [...VERIFIED_BASELINE],
    verifiedBaselinePassed: results.filter((r) =>
      VERIFIED_BASELINE.includes(r.id) && r.comparison.status === "MATCH").length,
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
  const verifiedPass = report.verifiedBaselinePassed === VERIFIED_BASELINE.length;
  if (!verifiedPass || report.total !== CONTROLLED_CASES.length * CONTROLLED_OPTIMIZATIONS.length) {
    process.exitCode = 1;
  }
  if (report.match !== report.total) {
    process.stdout.write(
      "Unresolved differential failures remain diagnostic: " +
      report.results.filter((r) => r.comparison.status !== "MATCH")
        .map((r) => r.id).join(", ") + "\n",
    );
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(String(error instanceof Error ? error.message : error) + "\n");
    process.exitCode = 1;
  });
}
