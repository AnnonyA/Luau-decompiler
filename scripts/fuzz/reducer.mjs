import { digest } from '../competition/external.mjs';

export function failureSignature(observation) {
  if (!observation?.originalValid) return null;
  if (observation.status === 'MISMATCH' && ['trace', 'runtime-error'].includes(observation.failureKind)) {
    return `MISMATCH:${observation.failureKind}`;
  }
  if (observation.status === 'INVALID' && observation.failureKind === 'syntax') return 'INVALID:syntax';
  return null;
}

/** Bounded line delta-debugging followed by integer shrinking. Every accepted
 * change is observed against an executing original and the same failure kind.
 * It yields a smaller reproducer, not a claim of global minimality. */
export async function reduceSource({ source, observe, maxAttempts = 60 }) {
  if (!Number.isInteger(maxAttempts) || maxAttempts < 2 || maxAttempts > 1000) throw Error('maxAttempts must be 2..1000');
  if (typeof source !== 'string' || !source.length || typeof observe !== 'function') throw Error('source and observe are required');
  let current = source, attempts = 0, accepted = 0;
  const history = [], seen = new Set();
  async function measure(candidate) {
    const sha256 = digest(candidate);
    seen.add(sha256);
    const observation = await observe(candidate, attempts++);
    return { observation, sha256 };
  }
  const initial = await measure(current);
  const signature = failureSignature(initial.observation);
  if (!signature) throw Error('initial source has no reducible observed failure');
  let finalObservation = initial.observation;
  async function tryCandidate(candidate) {
    if (!candidate.trim() || Buffer.byteLength(candidate) >= Buffer.byteLength(current) || seen.has(digest(candidate)) || attempts >= maxAttempts) return false;
    const { observation, sha256 } = await measure(candidate);
    const keep = failureSignature(observation) === signature;
    history.push({ attempt: attempts - 1, sourceSha256: sha256, sourceBytes: Buffer.byteLength(candidate), status: observation.status,
      failureKind: observation.failureKind, originalValid: observation.originalValid, accepted: keep });
    if (keep) { current = candidate; finalObservation = observation; accepted++; }
    return keep;
  }
  let granularity = 2;
  while (attempts < maxAttempts) {
    const lines = current.match(/[^\n]*\n|[^\n]+$/g) ?? [];
    if (lines.length < 2) break;
    const width = Math.ceil(lines.length / granularity);
    let changed = false;
    for (let offset = 0; offset < lines.length && attempts < maxAttempts; offset += width) {
      const candidate = [...lines.slice(0, offset), ...lines.slice(offset + width)].join('');
      if (await tryCandidate(candidate)) { changed = true; granularity = Math.max(2, granularity - 1); break; }
    }
    if (changed) continue;
    if (granularity >= lines.length) break;
    granularity = Math.min(lines.length, granularity * 2);
  }
  // Lexically conservative: never modify quoted strings, identifiers, or comments.
  const tokens = /--[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b\d+\b/g;
  let changed = true;
  while (changed && attempts < maxAttempts) {
    changed = false;
    for (const token of current.matchAll(tokens)) {
      if (!/^\d{2,}$/.test(token[0])) continue;
      const candidate = current.slice(0, token.index) + '0' + current.slice(token.index + token[0].length);
      if (await tryCandidate(candidate)) { changed = true; break; }
      if (attempts >= maxAttempts) break;
    }
  }
  return { source: current, originalBytes: Buffer.byteLength(source), reducedBytes: Buffer.byteLength(current),
    sourceSha256: digest(current), signature, attempts, maxAttempts, accepted, history, finalObservation,
    stopReason: attempts >= maxAttempts ? 'attempt-budget' : 'no-smaller-candidate', minimality: 'bounded search; global minimality is not established' };
}
