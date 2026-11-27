#!/usr/bin/env node
/**
 * Controlled behavioral differential for project-owned Luau source fixtures.
 * This does NOT establish full program equivalence or compare with LunaUX.
 * It compiles with pinned official luau-compile and executes those exact bytes
 * with an official-VM host supplied by CI; source files are never the oracle.
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
  // numbers
  "arithsigns", "arithdivision", "arithmodulo", "arithpowers", "arithprecedence",
  "arithnegzero", "comparisonnan", "comparisonsmixed", "bitwiseops", "mathfunctions",
  // branches
  "truthiness", "booleanreturn", "andorvalues", "chainedcomparisons", "elseifladder",
  "branchassignments", "earlyreturns", "nestedconditions", "nilchecks", "loopconditions",
  // loops
  "forascending", "fordescending", "forsteps", "forboundaries", "whilezero",
  "repeatonce", "repeatlocals", "breakwhile", "continuefor", "repeatcontinue",
  "genericipairs", "genericpairs",
  // closures
  "closuresnapshot", "closuremutations", "closuresiblings", "closureloop", "closurerecursive",
  "closurefactory", "closureshadow", "closureforward", "callbackarguments", "callbackreturn",
  // tables
  "tableholes", "tablelisttail", "tablekeyorder", "tableoverwrite", "tablealias",
  "tabledelete", "tablelength", "tablesort", "tableclone", "tablefreeze",
  // calls
  "callorder", "callnested", "callfixed", "callmultitail", "returnempty",
  "varargnil", "varargforward", "methodself", "methodmutate", "protectedcalls",
  // strings
  "stringbinary", "stringbom", "stringcontrols", "stringunicode", "stringpatterns",
  "stringformatnumbers", "stringinterpolation", "stringconcatassoc", "stringnumbercoercion", "stringsubbytes",
  // scope
  "localsreuse", "compoundread", "localtablesnapshot", "localfunctionbinding", "shadowmath",
  "shadowsglobals", "functionvaluefield",
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
    command: [program, ...args],
    ok: result.status === 0 && !result.error && !result.signal,
    status: result.status,
    signal: result.signal ?? null,
    stdout: result.stdout?.toString("utf8") ?? "",
    stderr: result.stderr?.toString("utf8") ?? "",
    stdoutSha256: digest(result.stdout ?? Buffer.alloc(0)),
    stderrSha256: digest(result.stderr ?? Buffer.alloc(0)),
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
  if (original.stdout !== reconstructed.stdout || original.stderr !== reconstructed.stderr ||
      (original.stdoutSha256 && reconstructed.stdoutSha256 && original.stdoutSha256 !== reconstructed.stdoutSha256) ||
      (original.stderrSha256 && reconstructed.stderrSha256 && original.stderrSha256 !== reconstructed.stderrSha256)) {
    return { status: "MISMATCH", reason: "observable stdout or stderr differs" };
  }
  return { status: "MATCH" };
}

/** One profile, exported so the bytecode-oracle contract can be tested without
 * running the complete allowlist or requiring an installed Luau toolchain. */
export async function runSemanticProfile({
  compiler, bytecodeRunner, originalPath, optimization, tempDir,
  caseId, sourceId = caseId, engine = decompile,
}) {
  const originalSource = await readFile(originalPath, "utf8");
  const compile = (path) => {
    const args = ["--binary", `-O${optimization}`, "-g1", path];
    return {...spawnSync(compiler, args, {
      cwd: tempDir, timeout: 15000, maxBuffer: 1024 * 1024,
      env: { PATH: process.env.PATH ?? "" },
    }), command: [compiler, ...args]};
  };
  const compileTrace = (result) => ({
    command: result.command, status: result.status, signal: result.signal ?? null,
    stderr: result.stderr?.toString("utf8") ?? "", error: result.error?.message ?? null,
    binarySha256: result.stdout?.length ? digest(result.stdout) : null,
  });
  const binary = compile(originalPath);
  if (binary.error || binary.status !== 0 || !binary.stdout?.length || binary.stdout[0] === 0) {
    throw new Error("official bytecode compilation failed for " + sourceId + ": " +
      (binary.stderr?.toString("utf8") ?? binary.error?.message ?? "empty output"));
  }
  const originalBinaryPath = join(tempDir, caseId + "-original.luauc");
  await writeFile(originalBinaryPath, binary.stdout);
  const bytecode = new Uint8Array(binary.stdout);
  let decompiled;
  try { decompiled = engine(bytecode, { opcodeEncoding: "official" }); }
  catch (error) { decompiled = { ok: false, code: "unexpected", error: String(error) }; }
  let recoveredRun = null, recoveredBinary = null, recoveredCompile = null;
  if (decompiled.ok) {
    const recoveredPath = join(tempDir, caseId + "-recovered.luau");
    await writeFile(recoveredPath, decompiled.source, "utf8");
    recoveredBinary = compile(recoveredPath);
    recoveredCompile = compileTrace(recoveredBinary);
    if (!recoveredBinary.error && recoveredBinary.status === 0 && recoveredBinary.stdout?.length && recoveredBinary.stdout[0] !== 0) {
      const recoveredBinaryPath = join(tempDir, caseId + "-recovered.luauc");
      await writeFile(recoveredBinaryPath, recoveredBinary.stdout);
      recoveredRun = launch(bytecodeRunner, [recoveredBinaryPath], tempDir);
    }
  }
  // The original is the same byte buffer passed to the engine, even if its
  // source changes afterwards. Re-reading/recompiling source is not equivalent.
  const originalRun = launch(bytecodeRunner, [originalBinaryPath], tempDir);
  const comparison = recoveredRun
    ? compareTraces(originalRun, recoveredRun)
    : { status: "ERROR", reason: decompiled.ok ? "recovered source compilation failed" : "decompiler failed: " + decompiled.code };
  if (recoveredRun && recoveredBinary.stdout[0] !== bytecode[0]) {
    comparison.status = "ERROR"; comparison.reason = "recompiled bytecode version differs from original";
  }
  return {
    id: caseId, sourceId, optimization,
    sourceSha256: digest(originalSource), binarySha256: digest(binary.stdout), bytecodeVersion: bytecode[0],
    originalBytecodeBase64: binary.stdout.toString("base64"),
    recoveredSha256: decompiled.ok ? digest(decompiled.source) : null,
    recoveredSource: decompiled.ok ? decompiled.source : null,
    recoveredBytecodeBase64: recoveredRun ? recoveredBinary.stdout.toString("base64") : null,
    recoveredBytecodeVersion: recoveredRun ? recoveredBinary.stdout[0] : null,
    originalCompilation: compileTrace(binary), recoveredCompilation: recoveredCompile,
    disassembly: decompiled.ok ? decompiled.disassembly : null,
    rawSource: decompiled.ok && decompiled.module
      ? printLuau(chunk(reconstructFunction(decompiled.module, decompiled.module.prototypes[decompiled.module.mainProtoId]).body.statements))
      : null,
    reconstructionSucceeded: decompiled.ok,
    originalExecution: originalRun, reconstructedExecution: recoveredRun, comparison,
  };
}

export async function runSemanticBenchmark({
  compiler, bytecodeRunner, interpreter, engine = decompile,
} = {}) {
  if (!compiler || !bytecodeRunner) {
    throw new Error("both --luau-compile and --bytecode-runner are required; a source interpreter cannot execute the saved bytecode oracle");
  }
  const tempDir = await mkdtemp(join(tmpdir(), "luau-semantic-"));
  const results = [];
  try {
    for (const id of CONTROLLED_CASES) {
      const originalPath = join(ROOT, "benchmarks", "semantic", id + ".luau");
      for (const optimization of CONTROLLED_OPTIMIZATIONS) {
        results.push(await runSemanticProfile({compiler, bytecodeRunner, engine, originalPath, optimization, tempDir,
          sourceId: id, caseId: optimization === 0 ? id : `${id}@O${optimization}`}));
      }
    }
  } finally { await rm(tempDir, { recursive: true, force: true }); }
  return {
    schemaVersion: 2, measuredAt: new Date().toISOString(), compiler, bytecodeRunner,
    legacyInterpreterArgument: interpreter ?? null,
    executionModel: "saved-bytecode",
    scope: "Controlled project-owned examples; exact compiled-bytecode stdout, stderr and exit success. NOT full semantic equivalence.",
    total: results.length,
    compilationProfiles: [...CONTROLLED_OPTIMIZATIONS].map((n) => `-O${n} -g1`),
    match: results.filter((r) => r.comparison.status === "MATCH").length,
    mismatch: results.filter((r) => r.comparison.status === "MISMATCH").length,
    errors: results.filter((r) => r.comparison.status === "ERROR").length,
    verifiedBaseline: [...VERIFIED_BASELINE],
    verifiedBaselinePassed: results.filter((r) => VERIFIED_BASELINE.includes(r.id) && r.comparison.status === "MATCH").length,
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
    else if (args[i] === "--bytecode-runner") options.bytecodeRunner = resolve(value);
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
