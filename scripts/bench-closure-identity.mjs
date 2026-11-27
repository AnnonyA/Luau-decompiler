#!/usr/bin/env node
/** Sealed synthetic inputs only. Originals are loaded from locked bytes, never
 * recompiled. In runtime controls the C++ runner loads one chunk once and
 * activates that same function four times. No external API is contacted. */
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {decompile} from '../dist/decompile.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2), options = {};
for (let i = 0; i < args.length; i += 2) {
  if (!['--luau-source', '--luau-build', '--output', '--manifest'].includes(args[i]) || !args[i + 1])
    throw Error('Usage: bench-closure-identity.mjs --luau-source DIR --luau-build DIR --output DIR [--manifest FILE]');
  options[args[i]] = resolve(args[i + 1]);
}
const source = options['--luau-source'], build = options['--luau-build'], output = options['--output'];
if (!source || !build || !output) throw Error('--luau-source, --luau-build and --output are required');
const manifestFile = options['--manifest'] ?? join(root, 'benchmarks/closure-identity/manifest.json');
const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
const corpus = dirname(manifestFile);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const commands = [];
mkdirSync(output, {recursive: true});

function launch(command, argv, timeout = 15000) {
  const result = spawnSync(command, argv, {timeout, maxBuffer: 16 * 1024 * 1024});
  const trace = {command: [command, ...argv], exit: result.status, signal: result.signal,
    stdout: result.stdout?.toString('utf8') ?? '', stderr: result.stderr?.toString('utf8') ?? '',
    error: result.error?.message ?? null};
  commands.push(trace);
  return {...trace, bytes: result.stdout ?? Buffer.alloc(0)};
}
function checked(command, argv, timeout) {
  const r = launch(command, argv, timeout);
  if (r.exit !== 0 || r.error) throw Error(`${command} failed: ${r.stderr || r.error}`);
  return r;
}
const revision = checked('git', ['-C', source, 'rev-parse', 'HEAD']).stdout.trim();
if (revision !== manifest.officialLuau) throw Error(`Expected official Luau ${manifest.officialLuau}, got ${revision}`);
checked('git', ['-C', source, 'diff', '--exit-code', 'HEAD', '--']);
const library = (make, cmake) => {
  const path = [join(build, make), join(build, cmake)].find(existsSync);
  if (!path) throw Error(`Missing ${make}/${cmake}; build the official compiler/VM first`);
  return path;
};
const vmLib = library('libluauvm.a', 'libLuau.VM.a');
const common = library('libluaucommon.a', 'libLuau.Common.a');
const support = join(root, 'scripts/closure-identity');
for (const name of ['run_bytecode', 'repeat_bytecode']) checked('c++', ['-std=c++17', '-O2',
  '-I', join(source, 'VM/include'), join(support, name + '.cpp'), vmLib, common, '-o', join(output, name)], 60000);
checked('c++', ['-std=c++17', '-O2', '-I', join(source, 'Compiler/include'), '-I', join(source, 'Ast/include'),
  '-I', join(source, 'Common/include'), join(support, 'compile_api.cpp'), '-Wl,--start-group',
  library('libluaucompiler.a', 'libLuau.Compiler.a'), library('libluauast.a', 'libLuau.Ast.a'),
  library('libluaubytecode.a', 'libLuau.Bytecode.a'), common, '-Wl,--end-group', '-o', join(output, 'compile_api')], 60000);

const results = [];
for (const profile of manifest.profiles) {
  const input = resolve(corpus, profile.bytecode), bytes = readFileSync(input);
  if (sha256(bytes) !== profile.input_sha256 || bytes[0] !== profile.bytecode_version)
    throw Error(`Sealed bytecode changed: ${profile.profile_id}`);
  const dir = join(output, ...profile.profile_id.split('/'));
  mkdirSync(dir, {recursive: true});
  const run = path => profile.suite === 'runtime'
    ? launch(join(output, 'repeat_bytecode'), [path, String(profile.optimization), profile.mode])
    : launch(join(output, 'run_bytecode'), [path, ...(profile.arguments ?? [])]);
  const original = run(input);
  if (original.exit !== 0 || original.error || original.stdout !== profile.sealed_stdout || original.stderr)
    throw Error(`Original trace changed: ${profile.profile_id}`);
  const decoded = decompile(bytes, {opcodeEncoding: 'official'});
  const result = {profile: profile.profile_id, inputSha256: profile.input_sha256, version: bytes[0],
    optimization: profile.optimization, original, status: 'DECOMPILE_ERROR'};
  if (decoded.ok) {
    const recovered = join(dir, 'annony.luau'), binary = join(dir, 'annony.luauc');
    writeFileSync(recovered, decoded.source);
    writeFileSync(join(dir, 'decoded.txt'), decoded.disassembly);
    writeFileSync(join(dir, 'diagnostics.json'), JSON.stringify(decoded.diagnostics, null, 2));
    const compiled = profile.suite === 'runtime'
      ? launch(join(output, 'compile_api'), [recovered, String(profile.optimization), binary])
      : launch(join(build, 'luau-compile'), ['--binary', `-O${profile.optimization}`, `-g${profile.debug}`, recovered]);
    if (profile.suite !== 'runtime') writeFileSync(binary, compiled.bytes);
    result.compile = {...compiled, bytes: undefined};
    result.sourceSha256 = sha256(decoded.source);
    if (compiled.exit === 0 && !compiled.error) {
      result.recompiledVersion = readFileSync(binary)[0];
      const reconstructed = run(binary);
      result.reconstructed = {...reconstructed, bytes: undefined};
      result.status = reconstructed.exit === original.exit && !reconstructed.error &&
        reconstructed.stdout === original.stdout && reconstructed.stderr === original.stderr ? 'MATCH' : 'EXECUTION_DIVERGENCE';
    } else result.status = 'COMPILE_ERROR';
  } else result.error = decoded.error;
  result.original = {...original, bytes: undefined};
  for (const [label, trace] of [['original', result.original], ['annony', result.reconstructed]]) if (trace) {
    writeFileSync(join(dir, label + '.stdout'), trace.stdout);
    writeFileSync(join(dir, label + '.stderr'), trace.stderr);
  }
  results.push(result);
  writeFileSync(join(output, 'results.json'), JSON.stringify({officialLuau: revision, results}, null, 2) + '\n');
}
writeFileSync(join(output, 'commands.json'), JSON.stringify(commands.map(c => ({...c, bytes: undefined})), null, 2) + '\n');
const match = results.filter(r => r.status === 'MATCH').length;
console.log(`Closure identity: ${match}/${results.length} MATCH`);
if (match !== results.length) {
  for (const r of results.filter(r => r.status !== 'MATCH')) console.error(`${r.profile}: ${r.status}`);
  process.exitCode = 1;
}
