import { describe, expect, it } from "vitest";
import { buildControlFlowGraph } from "../src/cfg/ControlFlowGraph.ts";
import { computeLiveness } from "../src/dataflow/Liveness.ts";
import { decodeBytecode } from "../src/decode/Decoder.ts";
import { abc, ad, compile, Opcode, proto } from "./helpers.ts";

function analyze(instructions: number[]) {
  const { module } = decodeBytecode(compile(proto({ instructions })), { opcodeEncoding: "official" });
  const cfg = buildControlFlowGraph(module.prototypes[module.mainProtoId]!);
  return { cfg, live: computeLiveness(cfg) };
}

describe("reachability-aware register liveness", () => {
  it("decodes zero, fixed, and open RETURN register-use counts accurately", () => {
    const used = (b: number): number[] => {
      const { module } = decodeBytecode(
        compile(proto({ instructions: [abc(Opcode.RETURN, 3, b, 0)] })),
        { opcodeEncoding: "official" },
      );
      return module.prototypes[module.mainProtoId]!.instructions[0]!.uses;
    };
    expect(used(1)).toEqual([]);
    expect(used(2)).toEqual([3]);
    expect(used(4)).toEqual([3, 4, 5]);
    expect(used(0)).toEqual([3]);
  });

  it("keeps a joined if/else result live but kills it in both defining arms", () => {
    const { cfg, live } = analyze([
      abc(Opcode.LOADB, 0, 1, 0),
      ad(Opcode.JUMPIFNOT, 0, 2),
      ad(Opcode.LOADN, 1, 10),
      ad(Opcode.JUMP, 0, 1),
      ad(Opcode.LOADN, 1, 20),
      abc(Opcode.RETURN, 1, 2, 0),
    ]);
    const join = cfg.blockOfPc.get(5)!;
    const thenBlock = cfg.blockOfPc.get(2)!;
    const elseBlock = cfg.blockOfPc.get(4)!;
    expect(live.liveIn[join]!.has(1)).toBe(true);
    expect(live.liveOut[thenBlock]!.has(1)).toBe(true);
    expect(live.liveOut[elseBlock]!.has(1)).toBe(true);
    expect(live.liveIn[thenBlock]!.has(1)).toBe(false);
    expect(live.liveIn[elseBlock]!.has(1)).toBe(false);
  });

  it("preserves incoming values when only one conditional arm redefines them", () => {
    const { cfg, live } = analyze([
      ad(Opcode.LOADN, 1, 5),
      ad(Opcode.JUMPIFNOT, 0, 1),
      ad(Opcode.LOADN, 1, 7),
      abc(Opcode.RETURN, 1, 2, 0),
    ]);
    const header = cfg.blockOfPc.get(0)!;
    expect(live.liveOut[header]!.has(1)).toBe(true);
    expect(live.liveIn[header]!.has(1)).toBe(false);
  });

  it("propagates values used in a loop body and after the loop to its header", () => {
    const { cfg, live } = analyze([
      ad(Opcode.LOADN, 1, 5),
      ad(Opcode.JUMPIFNOT, 0, 2), // 1 -> 4
      abc(Opcode.ADD, 1, 1, 2),
      ad(Opcode.JUMPBACK, 0, -3), // 3 -> 1
      abc(Opcode.RETURN, 1, 2, 0),
    ]);
    const header = cfg.blockOfPc.get(1)!;
    const preheader = cfg.blockOfPc.get(0)!;
    expect(live.liveIn[header]).toEqual(new Set([0, 1, 2]));
    expect(live.liveOut[preheader]!.has(1)).toBe(true);
  });

  it("does not propagate liveness through unreachable blocks", () => {
    const { cfg, live } = analyze([
      abc(Opcode.RETURN, 0, 1, 0), // 0: no return operands
      abc(Opcode.ADD, 2, 1, 3),    // 1: unreachable
      ad(Opcode.JUMPBACK, 0, -2),  // 2 -> 1
    ]);
    expect(cfg.blocks[1]!.unreachable).toBe(true);
    expect(live.liveIn[0]).toEqual(new Set());
    expect(live.liveOut[0]).toEqual(new Set());
    expect(live.liveIn[1]).toEqual(new Set());
  });
});
