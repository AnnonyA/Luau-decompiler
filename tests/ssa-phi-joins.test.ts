import { describe, expect, it } from "vitest";
import { buildControlFlowGraph } from "../src/cfg/ControlFlowGraph.ts";
import { computeDominators } from "../src/cfg/Dominators.ts";
import { decodeBytecode } from "../src/decode/Decoder.ts";
import { buildSsa } from "../src/ssa/SsaBuilder.ts";
import { abc, ad, compile, Opcode, proto, ret } from "./helpers.ts";

function analyze(instructions: number[]) {
  const { module } = decodeBytecode(compile(proto({ instructions })), { opcodeEncoding: "official" });
  const cfg = buildControlFlowGraph(module.prototypes[module.mainProtoId]!);
  const dom = computeDominators(cfg);
  return { cfg, dom, ssa: buildSsa(cfg, dom) };
}

describe("SSA phi placement at reachable control-flow joins", () => {
  it("does not create a phi for a dead predecessor entering a live return block", () => {
    const { cfg, dom, ssa } = analyze([
      ad(Opcode.LOADN, 1, 3),         // 0: live initializer
      ad(Opcode.JUMP, 0, 2),         // 1 -> 4
      ad(Opcode.LOADN, 1, 99),       // 2: unreachable
      ad(Opcode.JUMP, 0, 0),         // 3 -> 4
      abc(Opcode.RETURN, 1, 2, 0),   // 4
    ]);
    const join = cfg.blockOfPc.get(4)!;
    const dead = cfg.blockOfPc.get(2)!;
    expect(cfg.blocks[dead]!.unreachable).toBe(true);
    expect(cfg.blocks[join]!.predecessors).toHaveLength(2);
    expect(dom.dominanceFrontier[dead]).not.toContain(join);
    expect(ssa.phis.get(join) ?? []).toEqual([]);
    expect(ssa.values.some((v) => v.pc === 2)).toBe(false);
  });

  it("retains a real phi with both incoming assignments in an if/else diamond", () => {
    const { cfg, ssa } = analyze([
      abc(Opcode.LOADB, 0, 1, 0),   // 0
      ad(Opcode.JUMPIFNOT, 0, 2), // 1 -> 4
      ad(Opcode.LOADN, 1, 10),    // 2
      ad(Opcode.JUMP, 0, 1),      // 3 -> 5
      ad(Opcode.LOADN, 1, 20),    // 4
      abc(Opcode.RETURN, 1, 2, 0), // 5
    ]);
    const join = cfg.blockOfPc.get(5)!;
    const phi = ssa.phis.get(join)?.find((p) => p.register === 1);
    expect(phi).toBeDefined();
    expect(phi!.operands).toHaveLength(2);
    expect(new Set(phi!.operands.map((p) => p.pred))).toEqual(
      new Set([cfg.blockOfPc.get(2)!, cfg.blockOfPc.get(4)!]),
    );
    expect(phi!.operands.map((p) => ssa.values[p.value]!.pc).sort((a, b) => a - b)).toEqual([2, 4]);
  });

  it("merges a pre-existing value with one conditional reassignment", () => {
    const { cfg, ssa } = analyze([
      abc(Opcode.LOADB, 0, 1, 0),
      ad(Opcode.LOADN, 1, 5),
      ad(Opcode.JUMPIFNOT, 0, 1),  // 2 -> 4
      ad(Opcode.LOADN, 1, 7),
      abc(Opcode.RETURN, 1, 2, 0),
    ]);
    const phi = ssa.phis.get(cfg.blockOfPc.get(4)!)?.find((p) => p.register === 1);
    expect(phi).toBeDefined();
    expect(phi!.operands).toHaveLength(2);
    expect(phi!.operands.map((p) => ssa.values[p.value]!.pc).sort((a, b) => a - b)).toEqual([1, 3]);
  });

  it("excludes a dead third predecessor from an otherwise valid two-way merge", () => {
    const { cfg, ssa } = analyze([
      abc(Opcode.LOADB, 0, 1, 0),
      ad(Opcode.JUMPIFNOT, 0, 3),  // 1 -> 5
      ad(Opcode.LOADN, 1, 1),      // 2
      ad(Opcode.JUMP, 0, 3),       // 3 -> 7
      ad(Opcode.JUMP, 0, 2),       // 4 -> 7, unreachable
      ad(Opcode.LOADN, 1, 2),      // 5
      ad(Opcode.JUMP, 0, 0),       // 6 -> 7
      abc(Opcode.RETURN, 1, 2, 0), // 7
    ]);
    const join = cfg.blockOfPc.get(7)!;
    expect(cfg.blocks[join]!.predecessors).toHaveLength(3);
    const phi = ssa.phis.get(join)?.find((p) => p.register === 1);
    expect(phi).toBeDefined();
    expect(phi!.operands).toHaveLength(2);
    expect(phi!.operands.map((p) => ssa.values[p.value]!.pc).sort((a, b) => a - b)).toEqual([2, 5]);
  });
});
