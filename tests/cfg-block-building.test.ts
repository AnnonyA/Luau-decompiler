import { describe, expect, it } from "vitest";
import { buildControlFlowGraph } from "../src/cfg/ControlFlowGraph.ts";
import { decodeBytecode } from "../src/decode/Decoder.ts";
import { abc, ad, compile, Opcode, proto, ret } from "./helpers.ts";

describe("control-flow basic-block construction", () => {
  it("places every instruction in exactly one block across a branching diamond", () => {
    const bytes = compile(proto({
      instructions: [
        ad(Opcode.LOADN, 0, 1),
        ad(Opcode.JUMPIFNOT, 0, 2), // pc 1 -> 4
        ad(Opcode.LOADN, 1, 10),
        ad(Opcode.JUMP, 0, 1), // pc 3 -> 5
        ad(Opcode.LOADN, 1, 20),
        abc(Opcode.RETURN, 1, 2, 0),
      ],
    }));
    const { module } = decodeBytecode(bytes, { opcodeEncoding: "official" });
    const prototype = module.prototypes[module.mainProtoId]!;
    const cfg = buildControlFlowGraph(prototype);
    expect(cfg.blocks.map((block) => block.instructions.map((insn) => insn.pc))).toEqual([
      [0, 1], [2, 3], [4], [5],
    ]);
    expect(cfg.blocks[0]!.successors).toEqual([1, 2]);
    expect(cfg.blocks[1]!.successors).toEqual([3]);
    expect(cfg.blocks[2]!.successors).toEqual([3]);
    expect(cfg.blocks[3]!.successors).toEqual([]);
    expect([...cfg.blockOfPc.keys()].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("preserves instructions and edges for branch-heavy code without rescanning every block", () => {
    const instructions = Array.from({ length: 1024 }, () => ad(Opcode.JUMP, 0, 0));
    instructions.push(ret());
    const { module } = decodeBytecode(compile(proto({ instructions })), { opcodeEncoding: "official" });
    const cfg = buildControlFlowGraph(module.prototypes[module.mainProtoId]!);
    expect(cfg.blocks).toHaveLength(instructions.length);
    expect(cfg.blockOfPc.size).toBe(instructions.length);
    expect(cfg.blocks.every((block) => block.instructions.length === 1)).toBe(true);
    expect(cfg.blocks.every((block) => !block.unreachable)).toBe(true);
    expect(cfg.exits).toEqual([instructions.length - 1]);
  });
});
