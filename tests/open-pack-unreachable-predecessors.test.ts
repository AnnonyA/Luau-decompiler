import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {decodeBytecode} from '../src/decode/Decoder.ts';
import {reconstructFunction} from '../src/reconstruct/Reconstructor.ts';

const profiles = [0, 1, 2].flatMap(opt => [1, 2].map(debug => `O${opt}g${debug}`));
function nodes(value: unknown, kind: string): any[] {
  if (!value || typeof value !== 'object') return [];
  const node = value as Record<string, unknown>;
  return [...(node.kind === kind ? [node] : []), ...Object.values(node).flatMap(child => nodes(child, kind))];
}

describe('open packs across a join with an unreachable predecessor', () => {
  it.each(profiles)('preserves the vararg and call tails before control normalization (%s)', profile => {
    const bytes = readFileSync(new URL(
      `fixtures/rosetta-semantics/open-pack-dead-predecessor-${profile}-dead-entry.luauc`, import.meta.url));
    const module = decodeBytecode(bytes).module;
    // Exercise reconstruction directly: normalization can erase dead code,
    // but the reconstruction invariant must also hold when it declines.
    const main = reconstructFunction(module, module.prototypes[module.mainProtoId]!);
    const functions = nodes(main.body, 'function-expr');
    const inspect = functions.find(fn => fn.params[0] === 'tag');
    const counter = nodes(inspect.body, 'call').find(call => call.callee.kind === 'identifier' && call.callee.name === 'counter');
    expect(counter.args.at(-1).kind).toBe('vararg');
    const forward = functions.find(fn => fn.params[0] === 'producer');
    const result = nodes(forward.body, 'return')[0];
    expect(result.values).toHaveLength(1);
    expect(result.values[0].kind).toBe('call');
    expect(result.values[0].callee.name).toBe('producer');
  });
});
