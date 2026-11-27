#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {decompile} from '../dist/decompile.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const options = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  if (!process.argv[i]?.startsWith('--') || !process.argv[i + 1]) throw new Error('expected --option value');
  options.set(process.argv[i].slice(2), process.argv[i + 1]);
}
const required = name => {
  const value = options.get(name);
  if (!value) throw new Error(`required --${name}`);
  return path.resolve(value);
};
const luau = required('luau-root');
const apiCompiler = required('api-compiler');
const vm = required('vm');
const vm4 = required('vm4');
const output = required('out');
const fixtures = path.join(root, 'tests/fixtures/literal-fidelity');
const manifest = JSON.parse(fs.readFileSync(path.join(fixtures, 'manifest.json'), 'utf8'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? `${item}n` : item, 2) + '\n';
const git = (cwd, ...args) => {
  const run = spawnSync('git', args, {cwd, encoding: 'utf8'});
  if (run.status !== 0) throw new Error(run.stderr);
  return run.stdout.trim();
};
if (git(luau, 'rev-parse', 'HEAD') !== manifest.officialLuau || git(luau, 'status', '--porcelain', '--untracked-files=no')) {
  throw new Error(`official Luau must be clean at ${manifest.officialLuau}`);
}
// A new directory keeps every earlier comparison and exact returned source intact.
fs.mkdirSync(path.dirname(output), {recursive: true});
fs.mkdirSync(output);
const call = (argv, stem, binary = false) => {
  const result = spawnSync(argv[0], argv.slice(1), {timeout: 60_000, maxBuffer: 16 * 1024 * 1024});
  const stdout = result.stdout ?? Buffer.alloc(0), stderr = result.stderr ?? Buffer.alloc(0);
  fs.writeFileSync(stem + '.stdout', stdout);
  fs.writeFileSync(stem + '.stderr', stderr);
  return {argv, exit: result.status, signal: result.signal, error: result.error?.message,
    stdout: binary ? undefined : stdout.toString(), stderr: stderr.toString(),
    stdoutSha256: sha(stdout), stderrSha256: sha(stderr)};
};
const wanted = options.get('cases')?.split(',');
const profiles = manifest.profiles.filter(profile => !wanted || wanted.includes(profile.id.split('/')[0]));
if (!profiles.length) throw new Error('no selected profiles');
const results = [];
for (const profile of profiles) {
  const folder = path.join(output, ...profile.id.split('/'));
  fs.mkdirSync(folder, {recursive: true});
  const bytes = fs.readFileSync(path.join(fixtures, profile.bytecode));
  if (sha(bytes) !== profile.sha256 || bytes[0] !== profile.bytecodeVersion) throw new Error(`fixture mismatch: ${profile.id}`);
  const originalPath = path.join(folder, 'original.luac');
  fs.writeFileSync(originalPath, bytes);
  const result = {profile: profile.id, optimization: profile.optimization, bytecodeVersion: bytes[0],
    originalSha256: sha(bytes), compilerFlags: profile.compilerFlags, compilerOptions: profile.compilerOptions,
    runtime: {vectorSize: profile.vectorSize, vectorDouble: profile.vectorDouble, LuauIntegerLibrary: true},
    firstObservation: profile.firstObservation};
  const host = profile.vectorSize === 4 ? vm4 : vm;
  result.original = call([host, originalPath], path.join(folder, 'original.run'));
  const oracleMatches = ['exit', 'stdout', 'stderr'].every(key => result.original[key] === profile.original[key]);
  if (!oracleMatches) {
    result.status = 'ORIGINAL_ORACLE_MISMATCH';
  } else {
    const recovered = decompile(bytes, {opcodeEncoding: 'official', runtimeContext: false});
    result.diagnostics = recovered.diagnostics;
    if (!recovered.ok) {
      result.status = 'DECOMPILE_ERROR'; result.error = recovered.error;
    } else {
      const sourcePath = path.join(folder, 'annony.luau'), bytecodePath = path.join(folder, 'annony.luac');
      fs.writeFileSync(sourcePath, recovered.source);
      fs.writeFileSync(path.join(folder, 'original.disassembly.txt'), recovered.disassembly);
      fs.writeFileSync(path.join(folder, 'original.constants.json'), json(recovered.module.prototypes.map(p => ({id: p.id, constants: p.constants}))));
      result.recoveredSourceSha256 = sha(Buffer.from(recovered.source));
      if (profile.compiler === 'cli') {
        result.compile = call([path.join(luau, 'build/release/luau-compile'), '--binary', `-O${profile.optimization}`, '-g2',
          `--fflags=${profile.compilerFlags.explicit}`, sourcePath], path.join(folder, 'compile'), true);
        if (result.compile.exit === 0) fs.copyFileSync(path.join(folder, 'compile.stdout'), bytecodePath);
      } else {
        result.compile = call([apiCompiler, sourcePath, String(profile.optimization), bytecodePath, profile.compilerMode], path.join(folder, 'compile'));
      }
      if (result.compile.exit !== 0) result.status = 'RECOMPILE_ERROR';
      else {
        const recompiled = fs.readFileSync(bytecodePath);
        result.recompiledSha256 = sha(recompiled); result.recompiledVersion = recompiled[0];
        result.recovered = call([host, bytecodePath], path.join(folder, 'annony.run'));
        result.status = ['exit', 'stdout', 'stderr'].every(key => result.original[key] === result.recovered[key]) ? 'MATCH' : 'EXECUTION_DIVERGENCE';
      }
    }
  }
  fs.writeFileSync(path.join(folder, 'result.json'), json(result));
  results.push(result);
  console.log(`${profile.id}\t${result.status}`);
}
const report = {officialLuau: manifest.officialLuau, engineRevision: git(root, 'rev-parse', 'HEAD'),
  engineDirty: Boolean(git(root, 'status', '--porcelain', '--untracked-files=no')),
  engineDistSha256: sha(fs.readFileSync(path.join(root, 'dist/decompile.js'))),
  toolHashes: Object.fromEntries([apiCompiler, vm, vm4, path.join(luau, 'build/release/luau-compile')].map(file => [file, sha(fs.readFileSync(file))])),
  opcodePcTracing: false, results};
fs.writeFileSync(path.join(output, 'results.json'), json(report));
fs.writeFileSync(path.join(output, 'results.tsv'), ['profile\tversion\toptimization\tsha256\tstatus',
  ...results.map(r => [r.profile, r.bytecodeVersion, r.optimization, r.originalSha256, r.status].join('\t'))].join('\n') + '\n');
// A warning is not a semantic match. Even a documented remaining failure exits 1.
process.exitCode = results.every(result => result.status === 'MATCH') ? 0 : 1;
