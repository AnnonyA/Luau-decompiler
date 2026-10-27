import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { launch, classify } from '../competition/evaluate.mjs';
import { digest } from '../competition/external.mjs';
import { isolatedLocal } from '../large/local-runner.mjs';

function interrupted(run) { return Boolean(run?.error || run?.signal || run?.status === null); }
function interruptionKind(run) { return /ETIMEDOUT|timed out/i.test(run?.error ?? '') ? 'timeout' : 'process-error'; }

export function classifyObservation({ originals, parser, runs }) {
  if (!originals?.length || originals.some(run => !run.ok || !run.stdout)) {
    return { originalValid: false, status: 'INVALID_ORIGINAL', failureKind: 'original-execution', reason: 'original failed, timed out, or produced no trace' };
  }
  if (!parser || interrupted(parser)) return { originalValid: true, status: 'NOT_MEASURED', failureKind: interruptionKind(parser), reason: 'official parser did not complete' };
  if (!parser.ok) return { originalValid: true, ...classify({ originals, parser, runs }), failureKind: 'syntax' };
  if (runs?.length !== originals.length) return { originalValid: true, status: 'NOT_MEASURED', failureKind: 'incomplete', reason: 'incomplete runtime matrix' };
  const stopped = runs.find(interrupted);
  if (stopped) return { originalValid: true, status: 'NOT_MEASURED', failureKind: interruptionKind(stopped), reason: 'reconstructed execution did not complete' };
  const result = classify({ originals, parser, runs });
  return { originalValid: true, ...result, failureKind: result.status === 'MATCH' ? null : runs.some(run => !run.ok) ? 'runtime-error' : 'trace' };
}

export async function observeSource({ source, compiler, interpreter, directory, optimization, inputs, timeoutMs = 3000, compilerTimeoutMs = 15000, localRunner = isolatedLocal }) {
  if (![0, 1, 2].includes(optimization)) throw Error('optimization must be 0, 1, or 2');
  if (!Array.isArray(inputs) || !inputs.length || inputs.some(input => !Array.isArray(input) || input.some(arg => typeof arg !== 'string'))) throw Error('inputs must contain string argument arrays');
  await mkdir(directory, { recursive: true });
  const original = join(directory, 'original.luau');
  await writeFile(original, source);
  const compilerArgs = ['--binary', `-O${optimization}`, '-g1', original];
  const compiled = launch(compiler, compilerArgs, directory, compilerTimeoutMs);
  const record = { optimization, inputs, sourceSha256: digest(source), sourceBytes: Buffer.byteLength(source), compilerArgs, compiled };
  async function finish(result) {
    const observation = { ...record, ...result };
    await writeFile(join(directory, 'observation.json'), JSON.stringify(observation, null, 2) + '\n');
    return observation;
  }
  if (!compiled.ok || !compiled.stdout) return finish({ originalValid: false, status: 'INVALID_ORIGINAL', failureKind: interrupted(compiled) ? interruptionKind(compiled) : 'original-compile', reason: 'official compiler did not produce bytecode' });
  const bytes = Buffer.from(compiled.stdout, 'base64');
  await writeFile(join(directory, 'bytecode.luauc'), bytes);
  record.bytecodeSha256 = digest(bytes);
  record.bytecodeBytes = bytes.length;
  record.bytecodeVersion = bytes[0];
  record.originalRuns = inputs.map(input => launch(interpreter, [`-O${optimization}`, original, '-a', ...input], directory, timeoutMs));
  if (record.originalRuns.some(run => !run.ok || !run.stdout)) return finish(classifyObservation({ originals: record.originalRuns }));
  const recovered = await localRunner(bytes, directory);
  record.local = recovered.metadata;
  if (typeof recovered.source !== 'string') return finish({ originalValid: true, status: 'NOT_MEASURED', failureKind: 'decompile', reason: recovered.metadata?.reason ?? 'local decompiler returned no source' });
  const reconstructed = join(directory, 'reconstructed.luau');
  await writeFile(reconstructed, recovered.source);
  record.reconstructedSha256 = digest(recovered.source);
  record.parser = launch(compiler, ['--only-parse', reconstructed], directory, compilerTimeoutMs);
  record.runs = record.parser.ok ? inputs.map(input => launch(interpreter, [`-O${optimization}`, reconstructed, '-a', ...input], directory, timeoutMs)) : [];
  return finish(classifyObservation({ originals: record.originalRuns, parser: record.parser, runs: record.runs }));
}
