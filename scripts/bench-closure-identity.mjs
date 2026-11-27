#!/usr/bin/env node
/** Execute sealed bytecode with its declared host protocol. All comparisons use
 * saved original bytes and exact, unedited recovered source. No network access.
 * Aggregate manifests include the original corpus without rewriting its seals. */
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {decompile, decodeOnly} from '../dist/decompile.js';
import {disassembleModule} from '../dist/disasm/Disassembler.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2), options = {};
for (let i = 0; i < args.length; i += 2) {
  if (!['--luau-source', '--luau-build', '--output', '--manifest'].includes(args[i]) || !args[i + 1])
    throw Error('Usage: bench-closure-identity.mjs --luau-source DIR --luau-build DIR --output NEW_DIR [--manifest FILE]');
  options[args[i]] = resolve(args[i + 1]);
}
const source = options['--luau-source'], build = options['--luau-build'], output = options['--output'];
if (!source || !build || !output) throw Error('--luau-source, --luau-build and --output are required');
if (existsSync(output)) throw Error('Output directory already exists; choose a new path to retain prior observations');
mkdirSync(output, {recursive: true});
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const save = (path, data) => writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
const commands = [], manifestReceipts = [], profiles = [], loaded = new Set();
let officialLuau, benchmarkLabel = 'Closure identity';
function inside(base, path) {
  const target = resolve(base, path), rel = relative(base, target);
  if (rel === '..' || rel.startsWith('..' + sep) || rel.startsWith(sep)) throw Error(`Path escapes manifest: ${path}`);
  return target;
}
function loadManifest(path, groupOverride) {
  path = resolve(path);
  if (loaded.has(path)) throw Error(`Repeated or recursive manifest: ${path}`);
  loaded.add(path);
  const bytes = readFileSync(path), manifest = JSON.parse(bytes.toString('utf8')), corpus = dirname(path);
  officialLuau ??= manifest.officialLuau;
  if (loaded.size === 1 && manifest.label) benchmarkLabel = manifest.label;
  if (manifest.officialLuau !== officialLuau) throw Error(`Official revision differs in ${path}`);
  manifestReceipts.push({path: relative(root, path), sha256: sha256(bytes), profileCount: manifest.profiles?.length ?? 0});
  for (const child of manifest.include ?? []) {
    const name = typeof child === "string" ? child : child.manifest;
    loadManifest(inside(corpus, name), typeof child === "string" ? undefined : child.group);
  }
  for (const profile of manifest.profiles ?? []) {
    if (!/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_.-]+)*$/.test(profile.profile_id)) throw Error('Unsafe profile id');
    if (profiles.some(p => p.profile_id === profile.profile_id)) throw Error(`Duplicate profile: ${profile.profile_id}`);
    if (![9, 14].includes(profile.bytecode_version)) throw Error(`Unsupported sealed version: ${profile.bytecode_version}`);
    const runner = profile.runner ?? (profile.suite === 'runtime'
      ? {kind: 'repeat', mode: profile.mode, activation_count: 4}
      : {kind: 'plain', arguments: profile.arguments ?? [], activation_count: 1});
    profiles.push({...profile, group: profile.group ?? groupOverride ?? profile.suite, input: inside(corpus, profile.bytecode), runner});
  }
}
loadManifest(options['--manifest'] ?? join(root, 'benchmarks/closure-identity/complete-manifest.json'));
if (!profiles.length) throw Error('Manifest contains no profiles');
function launch(command, argv, timeout = 15000, stem = null, binary = false) {
  const startedAt = new Date().toISOString(), started = performance.now();
  const result = spawnSync(command, argv, {timeout, maxBuffer: 16 * 1024 * 1024});
  const stdout = result.stdout ?? Buffer.alloc(0), stderr = result.stderr ?? Buffer.alloc(0);
  const trace = {command: [command, ...argv], startedAt, durationMs: performance.now() - started,
    exit: result.status, signal: result.signal, stdout: binary ? null : stdout.toString('utf8'),
    stderr: stderr.toString('utf8'), error: result.error?.message ?? null,
    stdoutSha256: sha256(stdout), stderrSha256: sha256(stderr)};
  if (stem) {
    writeFileSync(stem + '.stdout', stdout); writeFileSync(stem + '.stderr', stderr);
    trace.stdoutFile = relative(output, stem + '.stdout'); trace.stderrFile = relative(output, stem + '.stderr');
  }
  commands.push(trace);
  save(join(output, 'commands.json'), commands);
  return {...trace, bytes: stdout};
}
function checked(command, argv, timeout, stem) {
  const r = launch(command, argv, timeout, stem);
  if (r.exit !== 0 || r.error) throw Error(`${command} failed: ${r.stderr || r.error}`);
  return r;
}
const revision = checked('git', ['-C', source, 'rev-parse', 'HEAD']).stdout.trim();
if (revision !== officialLuau) throw Error(`Expected official Luau ${officialLuau}, got ${revision}`);
checked('git', ['-C', source, 'diff', '--exit-code', 'HEAD', '--']);
const engineRevision = checked('git', ['-C', root, 'rev-parse', 'HEAD']).stdout.trim();
const engineWorkingChanges = checked('git', ['-C', root, 'status', '--porcelain', '--untracked-files=no']).stdout;
const library = (make, cmake) => {
  const path = [join(build, make), join(build, cmake)].find(existsSync);
  if (!path) throw Error(`Missing ${make}/${cmake}; build the official compiler/VM first`);
  return path;
};
const vmLib = library('libluauvm.a', 'libLuau.VM.a'), common = library('libluaucommon.a', 'libLuau.Common.a');
const support = join(root, 'scripts/closure-identity');
const runnerNames = {plain: 'run_bytecode', repeat: 'repeat_bytecode', 'entry-env': 'run_entry_environment', scenario: 'run_scenarios', flags: 'repeat_flags', 'numeric-pairs': 'run_numeric_pairs', 'game-systems': 'run_game_systems'};
for (const kind of new Set(profiles.map(p => p.runner.kind))) {
  const name = runnerNames[kind];
  if (!name) throw Error(`Unknown host protocol ${kind}`);
  checked('c++', ['-std=c++17', '-O2', '-I', join(source, 'VM/include'), join(support, name + '.cpp'),
    vmLib, common, '-o', join(output, name)], 60000, join(output, 'build-' + name));
}
checked('c++', ['-std=c++17', '-O2', '-I', join(source, 'Compiler/include'), '-I', join(source, 'Ast/include'),
  '-I', join(source, 'Common/include'), join(support, 'compile_api.cpp'), '-Wl,--start-group',
  library('libluaucompiler.a', 'libLuau.Compiler.a'), library('libluauast.a', 'libLuau.Ast.a'),
  library('libluaubytecode.a', 'libLuau.Bytecode.a'), common, '-Wl,--end-group', '-o', join(output, 'compile_api')],
  60000, join(output, 'build-compile_api'));
const provenance = {benchmarkLabel, officialLuau: revision, engineRevision, engineWorkingChanges, node: process.version,
  manifests: manifestReceipts, originalProfileCount: profiles.length, networkRequests: 0,
  sourceEdits: false, originalBytesRecompiled: false};
save(join(output, 'provenance.json'), provenance);
function hostArgs(profile, path) {
  const {runner} = profile;
  if (runner.kind === 'repeat') return [path, String(profile.optimization), runner.mode];
  if (runner.kind === 'scenario') return [path, runner.mode, ...(runner.arguments ?? [])];
  return [path, ...(runner.arguments ?? [])];
}
const withoutBytes = trace => ({...trace, bytes: undefined});
const sameTrace = (actual, expected) => actual.exit === expected.exit && !actual.error && !actual.signal &&
  actual.stdout === expected.stdout && actual.stderr === expected.stderr;
const results = [];
for (const profile of profiles) {
  const bytes = readFileSync(profile.input);
  if (sha256(bytes) !== profile.input_sha256 || bytes[0] !== profile.bytecode_version)
    throw Error(`Sealed bytecode changed: ${profile.profile_id}`);
  const dir = inside(output, profile.profile_id); mkdirSync(dir, {recursive: true});
  const run = (path, label) => launch(join(output, runnerNames[profile.runner.kind]), hostArgs(profile, path), 15000, join(dir, label));
  const original = run(profile.input, 'original');
  const expected = {exit: profile.sealed_exit ?? 0, stdout: profile.sealed_stdout, stderr: profile.sealed_stderr ?? ''};
  if (!sameTrace(original, expected)) throw Error(`Original trace changed: ${profile.profile_id}`);
  const result = {profile: profile.profile_id, inputSha256: profile.input_sha256, version: bytes[0],
    typesVersion: bytes[1], optimization: profile.optimization, debug: profile.debug, group: profile.group ?? profile.suite, runner: profile.runner,
    original: withoutBytes(original), status: 'DECOMPILE_ERROR'};
  try {
    const decoded = decompile(bytes, {opcodeEncoding: 'official', runtimeContext: false});
    if (decoded.ok) {
      const recovered = join(dir, 'annony.luau'), binary = join(dir, 'annony.luauc'), metadataFile = join(dir, 'compile-options.json');
      writeFileSync(recovered, decoded.source); writeFileSync(join(dir, 'original.decoded.txt'), decoded.disassembly);
      save(join(dir, 'diagnostics.json'), decoded.diagnostics);
      result.sourceSha256 = sha256(decoded.source);
      // The original version selects the entry point. Optimization directives are
      // parsed by the pinned official parser, retained, and obeyed by compilation.
      const api = bytes[0] === 9;
      const compiled = api
        ? launch(join(output, 'compile_api'), [recovered, String(profile.optimization), binary, metadataFile], 15000, join(dir, 'compile'))
        : launch(join(build, 'luau-compile'), ['--binary', `-O${profile.optimization}`, `-g${profile.debug}`, recovered], 15000, join(dir, 'compile'), true);
      if (!api) {
        writeFileSync(binary, compiled.bytes);
        checked(join(output, 'compile_api'), ['--inspect', recovered, String(profile.optimization), metadataFile], 15000, join(dir, 'inspect-compile-options'));
      }
      result.compile = withoutBytes(compiled);
      result.compilerEntry = api ? 'API-default-flags' : 'CLI-default-flags';
      result.compileOptions = JSON.parse(readFileSync(metadataFile, 'utf8'));
      if (compiled.exit === 0 && !compiled.error) {
        const recompiled = readFileSync(binary);
        result.recompiledVersion = recompiled[0]; result.recompiledTypesVersion = recompiled[1]; result.recompiledSha256 = sha256(recompiled);
        try {
          const inspection = decodeOnly(recompiled, {opcodeEncoding: 'official'});
          writeFileSync(join(dir, 'annony.decoded.txt'), disassembleModule(inspection.module));
        } catch (error) { result.recompiledDecodeError = String(error); }
        const reconstructed = run(binary, 'annony'); result.reconstructed = withoutBytes(reconstructed);
        result.status = sameTrace(reconstructed, original) ? 'MATCH' : 'EXECUTION_DIVERGENCE';
        if (result.recompiledVersion !== profile.bytecode_version) result.status = 'VERSION_MISMATCH';
      } else result.status = 'COMPILE_ERROR';
    } else result.error = decoded.error;
  } catch (error) { result.error = error?.stack ?? String(error); }
  results.push(result);
  save(join(output, 'results.json'), {...provenance, results});
  console.log(`${results.length}/${profiles.length} ${result.profile}: ${result.status}`);
}
const match = results.filter(r => r.status === 'MATCH').length;
save(join(output, 'summary.json'), {...provenance, matches: match, profiles: results.length,
  statuses: Object.fromEntries([...new Set(results.map(r => r.status))].map(s => [s, results.filter(r => r.status === s).length]))});
console.log(`${benchmarkLabel}: ${match}/${results.length} MATCH`);
if (match !== results.length) {
  for (const r of results.filter(r => r.status !== 'MATCH')) console.error(`${r.profile}: ${r.status}`);
  process.exitCode = 1;
}
