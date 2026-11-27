#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { suite, tierNames, validateResultText } from "./rosetta/validate.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const forbiddenOverrides = Object.freeze(["ROSETTA_TRANSFORM_OFF", "ROSETTA_TRANSFORM_ONLY", "LUAU_DECOMPILE_OPTS"]);

export function assertComparableEnvironment(environment = process.env) {
  for (const name of forbiddenOverrides) {
    if (Object.hasOwn(environment, name)) throw new Error(`Unset ${name}: comparable runs use the pinned transforms and default engine options`);
  }
}

export function decompilerCommand(nodePath, cliPath) {
  // Rosetta splits a command on whitespace; it does not parse shell quoting.
  // Reject these paths rather than producing an invalid command or silently using a shell.
  for (const path of [nodePath, cliPath]) {
    if (/\s/u.test(path) || path.includes("{}")) throw new Error(`Rosetta cannot represent whitespace or {} in a decompiler executable path: ${path}`);
  }
  return [nodePath, cliPath, "decompile", "{}"].join(" ");
}

export function parseArgs(args) {
  const options = { tier: "quick", threads: Math.min(4, availableParallelism()), measureOnly: false, gallery: false };
  const keys = { "--rosetta-dir": "rosettaDir", "--tier": "tier", "--out": "out", "--threads": "threads" };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--measure-only") options.measureOnly = true;
    else if (arg === "--gallery") options.gallery = true;
    else if (arg === "--help") options.help = true;
    else if (Object.hasOwn(keys, arg)) {
      const value = args[++i];
      if (!value || value.startsWith("--")) throw new Error(`${arg} requires a value`);
      options[keys[arg]] = arg === "--threads" ? Number(value) : value;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  if (options.help) return options;
  if (!options.rosettaDir) throw new Error("--rosetta-dir must point to the pinned Rosetta checkout");
  if (![...tierNames, "all"].includes(options.tier)) throw new Error(`--tier must be ${[...tierNames, "all"].join(", ")}`);
  if (!Number.isSafeInteger(options.threads) || options.threads < 1) throw new Error("--threads must be a positive integer");
  options.rosettaDir = resolve(options.rosettaDir);
  options.out = resolve(options.out ?? join(root, "tmp", "rosetta", new Date().toISOString().replace(/[:.]/g, "-")));
  return options;
}

function git(directory, args) {
  const result = spawnSync("git", ["-C", directory, ...args], { encoding: "utf8", maxBuffer: 16 << 20 });
  if (result.error || result.status !== 0) throw new Error(`git ${args.join(" ")}: ${result.error?.message ?? result.stderr.trim()}`);
  return result.stdout.trimEnd();
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function treeDigest(directory, entries) {
  const hash = createHash("sha256");
  const add = (relative) => {
    const path = join(directory, relative);
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) throw new Error(`Cannot fingerprint a symlinked build input: ${path}`);
    if (stat.isDirectory()) {
      for (const name of readdirSync(path).sort()) add(`${relative}/${name}`);
    } else if (stat.isFile()) {
      hash.update(relative).update("\0").update(sha256File(path)).update("\0");
    } else throw new Error(`Cannot fingerprint a non-regular build input: ${path}`);
  };
  for (const entry of [...entries].sort()) add(entry);
  return hash.digest("hex");
}

function engineSourceDigest() {
  const configuration = readdirSync(root).filter((name) => /^tsconfig.*\.json$/.test(name));
  return treeDigest(root, ["src", "package.json", "package-lock.json", ...configuration]);
}

function engineSnapshot() {
  const status = git(root, ["status", "--porcelain=v1", "--untracked-files=normal"]);
  return {
    revision: git(root, ["rev-parse", "HEAD"]),
    commitTree: git(root, ["rev-parse", "HEAD^{tree}"]),
    dirty: status.length > 0,
    status: status ? status.split("\n") : [],
    // Unlike HEAD^{tree}, this hashes the actual working files compiled for this run.
    sourceTreeSha256: engineSourceDigest(),
    distSha256: treeDigest(root, ["dist"]),
  };
}

export function inspectRosetta(directory) {
  const revision = git(directory, ["rev-parse", "HEAD"]);
  if (revision !== suite.revision) throw new Error(`Rosetta HEAD must be ${suite.revision}; found ${revision}`);
  const status = git(directory, ["status", "--porcelain=v1", "--untracked-files=no"]);
  if (status) throw new Error("Rosetta tracked files are modified; use the unmodified pinned checkout");
  // A file absent from Git can still change the corpus loaded from these directories.
  // Build products and local toolchains elsewhere in the checkout are permitted.
  const extraCorpus = git(directory, ["ls-files", "--others", "--", "cases", "libraries"]);
  if (extraCorpus) throw new Error("Rosetta cases/libraries contain untracked inputs; use the pinned corpus only");
  return { revision, commitTree: git(directory, ["rev-parse", "HEAD^{tree}"]), dirty: false };
}

/** Runs one real command, keeps the raw result even on failure, and seals its provenance.
 * Exported so tests can prove that a successful process exit cannot bypass result validation.
 */
export function runTier({ tier, out, binary, command, version, threads, gallery, measureOnly, environment, provenance, verifyUnchanged, stdio = "inherit" }) {
  mkdirSync(out, { recursive: true });
  const basename = `${suite.decompiler}-${tier}`;
  const resultPath = join(out, `${basename}.json`);
  const provenancePath = join(out, `${basename}.provenance.json`);
  for (const path of [resultPath, provenancePath, join(out, `${basename}.gallery.json`)]) {
    if (existsSync(path)) throw new Error(`Refusing to replace existing evidence: ${path}; choose a new --out directory`);
  }
  const args = ["bench", "--tier", tier, "--decompiler", `${suite.decompiler}=${command}`, "--version", `${suite.decompiler}=${version}`, "--out", out];
  if (gallery) args.push("--gallery");
  const record = {
    ...provenance,
    schemaVersion: 1,
    format: "annonyA-rosetta-provenance",
    tier,
    startedAt: new Date().toISOString(),
    status: "running",
    gate: measureOnly ? "measurement-only" : "all-pass",
    command: [binary, ...args],
    environment: { RAYON_NUM_THREADS: String(threads), forbiddenOverridesAbsent: forbiddenOverrides.filter((name) => !Object.hasOwn(environment, name)) },
    result: { path: resultPath, sha256: null },
    summary: null,
  };
  const save = () => writeFileSync(provenancePath, JSON.stringify(record, null, 2) + "\n");
  save();
  const started = performance.now();
  try {
    assertComparableEnvironment(environment);
    const child = spawnSync(binary, args, { cwd: provenance.rosetta.checkout, env: { ...environment, RAYON_NUM_THREADS: String(threads) }, stdio });
    record.process = { exitCode: child.status, signal: child.signal, error: child.error?.message ?? null };
    if (existsSync(resultPath)) record.result.sha256 = sha256File(resultPath);
    if (child.error || child.status !== 0) throw new Error(`Rosetta process failed: ${child.error?.message ?? child.signal ?? `exit ${child.status}`}`);
    if (verifyUnchanged) verifyUnchanged();
    record.summary = validateResultText(readFileSync(resultPath, "utf8"), { tier, expectedVersion: version, requireAllPass: false });
    if (!measureOnly && !record.summary.allPass) throw new Error(`Rosetta ${tier} all-pass gate failed: ${record.summary.passed}/${record.summary.total}`);
    record.status = "completed";
  } catch (error) {
    record.status = "failed";
    record.error = error.message;
  } finally {
    record.finishedAt = new Date().toISOString();
    record.elapsedSeconds = (performance.now() - started) / 1000;
    save();
  }
  return { ok: record.status === "completed", record, provenancePath };
}

function main(args) {
  const options = parseArgs(args);
  if (options.help) {
    console.log("Usage: npm run bench:rosetta -- --rosetta-dir PATH [--tier quick|full|hard-quick|hard-full|all] [--out PATH] [--threads N] [--gallery] [--measure-only]");
    console.log("The engine is rebuilt before measurement. All usable cases must pass unless --measure-only is explicit.");
    return;
  }
  assertComparableEnvironment();
  if (Number(process.versions.node.split(".")[0]) < 20) throw new Error("Node.js 20 or newer is required");
  const checkout = realpathSync(options.rosettaDir);
  const rosetta = inspectRosetta(checkout);
  const binary = realpathSync(join(checkout, "target", "release", "rosetta"));
  const binarySha256 = sha256File(binary);
  const cli = join(root, "dist", "cli.js");
  const command = decompilerCommand(process.execPath, cli);
  const sourceBeforeBuild = engineSourceDigest();
  const revisionBeforeBuild = git(root, ["rev-parse", "HEAD"]);
  const buildCommand = [process.execPath, join(root, "node_modules", "typescript", "bin", "tsc"), "-p", join(root, "tsconfig.json")];
  console.log("Rebuilding the decompiler with the measured Node.js runtime...");
  const build = spawnSync(buildCommand[0], buildCommand.slice(1), { cwd: root, stdio: "inherit" });
  if (build.error || build.status !== 0) throw new Error(`Engine build failed: ${build.error?.message ?? `exit ${build.status}`}`);
  if (!existsSync(cli)) throw new Error("The build did not produce dist/cli.js");
  const engine = engineSnapshot();
  if (engine.sourceTreeSha256 !== sourceBeforeBuild || engine.revision !== revisionBeforeBuild) throw new Error("Engine source changed while building; repeat the measurement with a stable checkout");
  const version = `${engine.revision}${engine.dirty ? "+dirty" : ""}`;
  const provenance = {
    integration: {
      pinSha256: sha256File(join(root, "benchmarks", "rosetta", "suite.json")),
      runnerSha256: sha256File(fileURLToPath(import.meta.url)),
      validatorSha256: sha256File(join(root, "scripts", "rosetta", "validate.mjs")),
    },
    engine: { ...engine, checkout: root, cli, buildCommand },
    rosetta: { ...rosetta, checkout, repository: suite.repository, suite: suite.suite, luau: suite.luau, transform: suite.transformVersion, binary, binarySha256 },
    runtime: { node: process.version, executable: process.execPath, executableSha256: sha256File(process.execPath), platform: process.platform, arch: process.arch, nodeOptions: process.env.NODE_OPTIONS ?? null },
    timing: "direct CLI per bytecode; includes Node.js startup and decompilation; no HTTP client/server split",
  };
  const verifyUnchanged = () => {
    const after = engineSnapshot();
    for (const key of ["revision", "commitTree", "sourceTreeSha256", "distSha256"]) {
      if (after[key] !== engine[key]) throw new Error(`Engine ${key} changed during measurement; results cannot be attributed to one build`);
    }
    inspectRosetta(checkout);
    if (sha256File(binary) !== binarySha256) throw new Error("Rosetta binary changed during measurement");
  };
  const tiers = options.tier === "all" ? tierNames : [options.tier];
  for (const tier of tiers) {
    verifyUnchanged();
    console.log(`Running pinned Rosetta ${tier} (${options.measureOnly ? "measurement only" : "all-pass gate"})...`);
    const result = runTier({ ...options, tier, binary, command, version, environment: process.env, provenance, verifyUnchanged });
    if (result.record.summary) {
      const summary = result.record.summary;
      console.log(`${tier}: ${summary.passed}/${summary.total}; ${JSON.stringify(summary.counts)}`);
    }
    console.log(`Provenance: ${result.provenancePath}`);
    if (!result.ok) {
      console.error(result.record.error);
      process.exitCode = 1;
    } else if (options.measureOnly) console.log("Measurement retained; --measure-only does not assert that all tests pass.");
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
