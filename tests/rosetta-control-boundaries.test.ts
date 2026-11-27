import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {decompile} from '../src/decompile.ts';
import {analyzeBindings} from '../src/analysis/Bindings.ts';
import {analyzePrototype} from '../src/reconstruct/Reconstructor.ts';
import {Opcode} from '../src/decode/Opcode.ts';

const profiles = [0, 1, 2].flatMap(opt => [1, 2].map(debug => `O${opt}g${debug}`));
const names = ['conditional-binding-loop', 'shared-iteration-tail', 'iterator-state',
  'repeat-condition-setup', 'loop-accumulator', 'terminal-numeric-for', 'predicate-loop-result',
  'nullable-selection', 'guarded-reservation-loop'];
const fixture = (name: string, profile: string) => readFileSync(new URL(
  `fixtures/rosetta-control/${name}-${profile}.luauc`, import.meta.url));
function nodes(value: unknown, kind: string): Record<string, any>[] {
  if (!value || typeof value !== 'object') return [];
  const node = value as Record<string, any>;
  return [...(node.kind === kind ? [node] : []), ...Object.values(node).flatMap(child => nodes(child, kind))];
}

describe('loop state and nested region boundaries', () => {
  it.each(profiles)('keeps every reconstructed local in lexical scope at %s', profile => {
    for (const name of names) {
      const result = decompile(fixture(name, profile), {opcodeEncoding: 'official'});
      expect(result.ok, name).toBe(true);
      if (!result.ok) throw new Error(result.error);
      expect(result.validation, name).toEqual([]);
      const globals = [...analyzeBindings(result.ast.body).globals];
      expect(globals.filter(global => !['print', 'error', 'table', 'next', 'ipairs'].includes(global)), name).toEqual([]);
    }
  });

  it.each(profiles)('does not turn a condition before body work into until at %s', profile => {
    const result = decompile(fixture('conditional-binding-loop', profile));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    const main = result.module.prototypes[result.module.mainProtoId]!;
    const ir = analyzePrototype(main);
    expect(ir.loops).toHaveLength(1);
    expect(ir.loops[0]!.kind).not.toBe('repeat');
    const latch = ir.cfg.blocks[ir.loops[0]!.latch]!;
    expect(latch.instructions.some(insn => insn.opcode === Opcode.ADD || insn.opcode === Opcode.ADDK)).toBe(true);
    expect([...nodes(result.ast, 'function-expr'), ...nodes(result.ast, 'function-decl')]).toHaveLength(1);
  });

  it.each(profiles)('retains explicit next iterator state at %s', profile => {
    const result = decompile(fixture('iterator-state', profile));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    const loops = nodes(result.ast, 'generic-for');
    expect(loops).toHaveLength(4);
    expect(loops[0]!.iterators).toHaveLength(2);
    expect(loops[1]!.iterators).toHaveLength(3);
    expect(loops[1]!.iterators[2]).toEqual({kind: 'literal', value: 1});
  });

  it.each(profiles)('reads the repeat condition from its setup at %s', profile => {
    const result = decompile(fixture('repeat-condition-setup', profile));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    const repeats = nodes(result.ast, 'repeat');
    expect(repeats.length).toBeGreaterThan(0);
    for (const repeat of repeats) {
      expect(nodes(repeat.test, 'unary').some(node => node.op === '#')).toBe(true);
    }
  });

  it.each(profiles)('retains numeric prep/step ownership without a reachable backedge at %s', profile => {
    const result = decompile(fixture('terminal-numeric-for', profile));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    const main = result.module.prototypes[result.module.mainProtoId]!;
    const ir = analyzePrototype(main);
    // O2 unrolls the three tiny constant ranges. The large nested range and
    // the parameterized returning loop retain their explicit iteration pair.
    const mainLoopCount = profile.startsWith('O2') ? 1 : 4;
    expect(ir.loops.filter(loop => loop.kind === 'numeric-for' && loop.backEdges.length === 0)).toHaveLength(mainLoopCount);
    expect(nodes(result.ast, 'numeric-for')).toHaveLength(mainLoopCount + 1);
  });

  it.each(['O2g1', 'O2g2'])('joins predicate-return values beyond the loop at %s', profile => {
    const result = decompile(fixture('predicate-loop-result', profile));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    const main = result.module.prototypes[result.module.mainProtoId]!;
    const ir = analyzePrototype(main);
    expect(ir.loops).toHaveLength(2);
    for (const loop of ir.loops) {
      const follow = ir.structure.loopFollowByLoop.get(loop)!;
      expect(follow).not.toBe(ir.cfg.blocks[loop.latch]!.fallthrough);
      expect(ir.ssa.phis.get(follow)?.length).toBeGreaterThan(0);
    }
  });

  it.each(profiles)('keeps an early return inside a compound while at %s', profile => {
    const result = decompile(fixture('guarded-reservation-loop', profile));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    const analyses = result.module.prototypes.map(analyzePrototype);
    const owner = analyses.find(ir => ir.loops.some(loop => loop.kind === 'infinite'))!;
    expect(owner).toBeDefined();
    const loop = owner.loops.find(loop => loop.kind === 'infinite')!;
    const follow = owner.structure.loopFollowByLoop.get(loop)!;
    expect(follow).toBeDefined();
    expect(owner.cfg.blocks[follow]!.instructions.at(-1)?.opcode).not.toBe(Opcode.RETURN);
    const exits = loop.blocks.flatMap(id => owner.cfg.blocks[id]!.successors)
      .filter(id => !loop.blocks.includes(id));
    expect(exits.some(id => owner.cfg.blocks[id]!.instructions.at(-1)?.opcode === Opcode.RETURN)).toBe(true);
  });
});
