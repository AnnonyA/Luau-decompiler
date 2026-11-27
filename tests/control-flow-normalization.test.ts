import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { normalizeControlFlow } from "../src/decode/NormalizeControlFlow.ts";
import { buildControlFlowGraph } from "../src/cfg/ControlFlowGraph.ts";
import { decompile } from "../src/decompile.ts";
import type { NumericForStatement } from "../src/ast/Ast.ts";
import { abc, ad, CaptureType, decode, Opcode, proto, sourceOf } from "./helpers.ts";

const normalize = (instructions: number[], options: Parameters<typeof proto>[0] extends infer T ? Partial<T> : never = {}) => {
  const original = decode(proto({ ...options, instructions })).module;
  return { original, normalized: normalizeControlFlow(original) };
};

describe("reconstruction control-flow normalization", () => {
  it("gives a boolean load with a skip only its taken successor", () => {
    const input = decode(proto({ numParams: 1, instructions: [ad(Opcode.JUMPIF, 0, 1),
      abc(Opcode.LOADB, 1, 0, 1), abc(Opcode.LOADB, 1, 1, 0), abc(Opcode.RETURN, 1, 2, 0)] })).module.prototypes[0]!;
    const cfg = buildControlFlowGraph(input);
    const skipped = cfg.blocks.find(block => block.instructions.at(-1)?.opcode === Opcode.LOADB && block.instructions.at(-1)?.c === 1)!;
    expect(skipped.fallthrough).toBeUndefined();
    expect(skipped.successors).toEqual([cfg.blockOfPc.get(3)]);
  });

  it("uses Luau truthiness, including numeric zero", () => {
    const input = proto({ instructions: [ad(Opcode.LOADN, 0, 0), ad(Opcode.JUMPIF, 0, 2),
      ad(Opcode.LOADN, 0, 99), abc(Opcode.RETURN, 0, 2, 0),
      ad(Opcode.LOADN, 0, 7), abc(Opcode.RETURN, 0, 2, 0)] });
    expect(sourceOf(input)).toBe("return 7\n");
  });

  it("retains unknown self equality and unordered NaN comparisons", () => {
    const unknown = normalize([ad(Opcode.JUMPIFEQ, 0, 3), 0, ad(Opcode.LOADN, 1, 1), abc(Opcode.RETURN, 1, 2, 0),
      ad(Opcode.LOADN, 1, 2), abc(Opcode.RETURN, 1, 2, 0)], { numParams: 1 });
    expect(unknown.normalized.prototypes[0]!.instructions.some(i => i.opcode === Opcode.JUMPIFEQ)).toBe(true);
    const nan = proto({ constants: [{ kind: "number", value: NaN }], instructions: [ad(Opcode.LOADK, 0, 0),
      ad(Opcode.JUMPIFEQ, 0, 3), 0, ad(Opcode.LOADN, 0, 1), abc(Opcode.RETURN, 0, 2, 0),
      ad(Opcode.LOADN, 0, 2), abc(Opcode.RETURN, 0, 2, 0)] });
    expect(sourceOf(nan)).toBe("return 1\n");
  });

  it("forgets facts about open reference captures across a call", () => {
    const child = proto({ numUpvalues: 1, instructions: [ad(Opcode.LOADN, 0, 2), abc(Opcode.SETUPVAL, 0, 0, 0), abc(Opcode.RETURN, 0, 1, 0)] });
    const { normalized } = normalize([ad(Opcode.LOADN, 0, 1), ad(Opcode.NEWCLOSURE, 1, 0), abc(Opcode.CAPTURE, CaptureType.REF, 0, 0),
      abc(Opcode.CALL, 1, 1, 1), ad(Opcode.JUMPXEQKN, 0, 3), 0,
      ad(Opcode.LOADN, 0, 10), abc(Opcode.RETURN, 0, 2, 0), ad(Opcode.LOADN, 0, 20), abc(Opcode.RETURN, 0, 2, 0)],
      { children: [child], constants: [{ kind: "number", value: 1 }] });
    const main = normalized.prototypes[normalized.mainProtoId]!;
    expect(main.instructions.some(i => i.opcode === Opcode.JUMPXEQKN)).toBe(true);
    expect(main.instructions.filter(i => i.opcode === Opcode.CAPTURE).map(i => i.capture)).toEqual([{ type: CaptureType.REF, source: 0 }]);
  });

  it("does not drop a live backward jump because an adjacent dead stub has the same target", () => {
    const { original, normalized } = normalize([ad(Opcode.LOADN, 0, 3), ad(Opcode.JUMP, 0, 2),
      abc(Opcode.SUBK, 0, 0, 0), ad(Opcode.JUMPBACK, 0, 0),
      ad(Opcode.JUMPXEQKN, 0, 3), 1, ad(Opcode.JUMP, 0, -5), ad(Opcode.JUMP, 0, -6), abc(Opcode.RETURN, 0, 2, 0)],
      { constants: [{ kind: "number", value: 1 }, { kind: "number", value: 0 }] });
    expect(original.prototypes[0]!.code.length).toBe(9);
    const main = normalized.prototypes[0]!, cfg = buildControlFlowGraph(main);
    expect(cfg.blocks.filter(block => !block.unreachable && block.successors.length === 0)
      .every(block => block.instructions.at(-1)?.opcode === Opcode.RETURN)).toBe(true);
    expect(main.instructions.some(insn => insn.opcode === Opcode.JUMPBACK)).toBe(true);
    expect(original.prototypes[0]!.instructions[6]!.jumpTarget).toBe(2);
  });

  it("retains unreachable numeric loop markers for a body that always breaks", () => {
    const { normalized } = normalize([ad(Opcode.LOADN, 0, 3), ad(Opcode.LOADN, 1, 1), ad(Opcode.LOADN, 2, 1),
      ad(Opcode.FORNPREP, 0, 3), ad(Opcode.MOVE, 3, 2), ad(Opcode.JUMP, 0, 1),
      ad(Opcode.FORNLOOP, 0, -3), abc(Opcode.RETURN, 3, 2, 0)]);
    expect(normalized.prototypes[0]!.instructions.some(insn => insn.opcode === Opcode.FORNLOOP)).toBe(true);
  });

  it.each(["O0g2-x2", "O2g1-x3"])("keeps the terminal numeric-loop break after shuffled %s layout", profile => {
    const result = decompile(readFileSync(new URL(`./fixtures/control-flow-normalization/shuffled-terminal-loops-${profile}.luauc`, import.meta.url)));
    if (!result.ok) throw new Error(result.error);
    const loops: NumericForStatement[] = [];
    const visit = (node: unknown): void => {
      if (Array.isArray(node)) { node.forEach(visit); return; }
      if (!node || typeof node !== "object") return;
      if ((node as {kind?: string}).kind === "numeric-for") loops.push(node as NumericForStatement);
      Object.values(node).forEach(visit);
    };
    visit(result.ast);
    expect(loops.some(loop => loop.body.statements.at(-1)?.kind === "break")).toBe(true);
  });

  it("preserves CLOSEUPVALS boundaries and scalar return arity across removed no-ops", () => {
    const { original, normalized } = normalize([ad(Opcode.LOADN, 0, 7), abc(Opcode.NOP, 0, 0, 0),
      abc(Opcode.CLOSEUPVALS, 2, 0, 0), ad(Opcode.JUMP, 0, 0), abc(Opcode.RETURN, 0, 2, 0)]);
    const instructions = normalized.prototypes[0]!.instructions;
    expect(instructions.find(i => i.opcode === Opcode.CLOSEUPVALS)?.a).toBe(2);
    expect(instructions.find(i => i.opcode === Opcode.CLOSEUPVALS)?.originalPc).toBe(2);
    expect(instructions.at(-1)?.b).toBe(2);
    expect(original.prototypes[0]!.instructions).toHaveLength(5);
  });

  it("keeps fixed arguments before an open vararg and preserves open results", () => {
    const { normalized } = normalize([abc(Opcode.PREPVARARGS, 1, 0, 0), ad(Opcode.LOADN, 1, 7),
      abc(Opcode.GETVARARGS, 2, 0, 0), abc(Opcode.NOP, 0, 0, 0), ad(Opcode.JUMP, 0, 0),
      abc(Opcode.CALL, 0, 0, 0), abc(Opcode.RETURN, 0, 0, 0)], { numParams: 1, isVararg: true });
    const instructions = normalized.prototypes[0]!.instructions;
    expect(instructions.find(i => i.opcode === Opcode.LOADN)?.d).toBe(7);
    expect(instructions.find(i => i.opcode === Opcode.CALL)?.call).toMatchObject({ argumentCount: "multret", resultCount: "multret" });
    expect(instructions.find(i => i.opcode === Opcode.CALL)?.uses).toEqual([0, 1, 2]);
    expect(instructions.at(-1)?.b).toBe(0);
  });

  it("rebuilds generic-loop variable definitions after moving its preparation", () => {
    const { normalized } = normalize([abc(Opcode.NOP, 0, 0, 0), ad(Opcode.FORGPREP, 0, 1),
      abc(Opcode.RETURN, 3, 3, 0), ad(Opcode.FORGLOOP, 0, -2), 2, abc(Opcode.RETURN, 0, 1, 0)], { numParams: 3 });
    const instructions = normalized.prototypes[0]!.instructions;
    expect(instructions.find(i => i.opcode === Opcode.FORGPREP)?.defs).toEqual([3, 4]);
    expect(instructions.find(i => i.opcode === Opcode.FORGPREP)?.originalPc).toBe(1);
  });

  it("keeps a high register live across fixed and potentially empty call results", () => {
    const child = proto({ maxStackSize: 1, instructions: [abc(Opcode.RETURN, 0, 1, 0)] });
    for (const resultCount of ["multret", 0, 1, 2] as const) {
      const { normalized } = normalize([ad(Opcode.LOADN, 5, 37), ad(Opcode.NEWCLOSURE, 0, 0),
        abc(Opcode.CALL, 0, 1, resultCount === "multret" ? 0 : resultCount + 1), abc(Opcode.RETURN, 5, 2, 0)], { children: [child] });
      const main = normalized.prototypes[normalized.mainProtoId]!;
      expect(main.instructions.find(i => i.opcode === Opcode.LOADN && i.a === 5)?.d).toBe(37);
      expect(main.instructions.find(i => i.opcode === Opcode.CALL)?.call?.resultCount).toBe(resultCount);
    }
  });

  it("does not treat a potentially empty vararg pack as a definite scalar write", () => {
    const { normalized } = normalize([abc(Opcode.PREPVARARGS, 0, 0, 0), ad(Opcode.LOADN, 0, 37),
      abc(Opcode.GETVARARGS, 0, 0, 0), abc(Opcode.RETURN, 0, 2, 0)], { isVararg: true });
    expect(normalized.prototypes[0]!.instructions.find(i => i.opcode === Opcode.LOADN)?.d).toBe(37);
  });

  it("does not make old high scalars live merely because a later producer has an open tail", () => {
    const { normalized } = normalize([abc(Opcode.PREPVARARGS, 1, 0, 0), ad(Opcode.LOADN, 5, 37), ad(Opcode.LOADN, 1, 7),
      abc(Opcode.GETVARARGS, 2, 0, 0), abc(Opcode.NOP, 0, 0, 0), ad(Opcode.JUMP, 0, 0),
      abc(Opcode.CALL, 0, 0, 1), abc(Opcode.RETURN, 0, 1, 0)], { numParams: 1, isVararg: true });
    const instructions = normalized.prototypes[0]!.instructions;
    expect(instructions.some(i => i.opcode === Opcode.LOADN && i.a === 5)).toBe(false);
    expect(instructions.find(i => i.opcode === Opcode.LOADN && i.a === 1)?.d).toBe(7);
  });

  it("keeps a scalar written into an existing dynamic result tail", () => {
    const { normalized } = normalize([abc(Opcode.PREPVARARGS, 0, 0, 0), abc(Opcode.GETVARARGS, 2, 0, 0),
      ad(Opcode.LOADN, 5, 37), abc(Opcode.RETURN, 2, 0, 0)], { isVararg: true });
    expect(normalized.prototypes[0]!.instructions.find(i => i.opcode === Opcode.LOADN)?.d).toBe(37);
  });

  it("forgets an open tail when a fixed call resets the frame top", () => {
    const { normalized } = normalize([abc(Opcode.PREPVARARGS, 1, 0, 0), ad(Opcode.LOADN, 5, 37),
      abc(Opcode.GETVARARGS, 2, 0, 0), abc(Opcode.CALL, 0, 1, 1), abc(Opcode.RETURN, 2, 0, 0)],
      { numParams: 1, isVararg: true });
    expect(normalized.prototypes[0]!.instructions.find(i => i.opcode === Opcode.LOADN)?.d).toBe(37);
  });

  it("declines a bounded tail when one incoming path has no open producer", () => {
    const { normalized } = normalize([abc(Opcode.PREPVARARGS, 2, 0, 0), ad(Opcode.LOADN, 5, 37),
      ad(Opcode.JUMPIF, 1, 1), abc(Opcode.GETVARARGS, 2, 0, 0), abc(Opcode.CALL, 0, 0, 1), abc(Opcode.RETURN, 0, 1, 0)],
      { numParams: 2, isVararg: true });
    expect(normalized.prototypes[0]!.instructions.find(i => i.opcode === Opcode.LOADN)?.d).toBe(37);
  });
});
