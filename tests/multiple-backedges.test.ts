import { describe, expect, it } from "vitest";
import { buildControlFlowGraph } from "../src/cfg/ControlFlowGraph.ts";
import { computeDominators, computePostDominators } from "../src/cfg/Dominators.ts";
import { findNaturalLoops } from "../src/cfg/NaturalLoops.ts";
import { structureControlFlow } from "../src/cfg/Structure.ts";
import { decodeBytecode } from "../src/decode/Decoder.ts";
import { abc, ad, compile, Opcode, proto, ret } from "./helpers.ts";

function analyze(words: number[]) {
  const { module } = decodeBytecode(compile(proto({ instructions: words })), { opcodeEncoding: "official" });
  const cfg = buildControlFlowGraph(module.prototypes[module.mainProtoId]!);
  const dom = computeDominators(cfg);
  const loops = findNaturalLoops(cfg, dom);
  const regions = structureControlFlow(cfg, dom, computePostDominators(cfg), loops).regions;
  return { cfg, loops, regions };
}

describe("loops with multiple continue/backedges", () => {
  it("merges multiple backedges into one loop with a complete body", () => {
    const { cfg, loops, regions } = analyze([
      ad(Opcode.LOADN, 0, 1),         // pc 0, executed once
      ad(Opcode.JUMPIFNOT, 0, 4),     // pc 1 -> pc 6, loop exit
      ad(Opcode.JUMPIF, 0, -2),       // pc 2 -> pc 1, continue path
      ad(Opcode.LOADN, 1, 2),         // pc 3, body
      ad(Opcode.JUMPBACK, 0, -4),     // pc 4 -> pc 1, regular latch
      ad(Opcode.JUMP, 0, -3),         // pc 5 -> pc 3, UNREACHABLE predecessor of body
      ret(),                          // pc 6
    ]);
    const header = cfg.blockOfPc.get(1)!;
    const continueBlock = cfg.blockOfPc.get(2)!;
    const bodyBlock = cfg.blockOfPc.get(3)!;
    const deadBlock = cfg.blockOfPc.get(5)!;
    expect(cfg.blocks[deadBlock]!.unreachable).toBe(true);
    expect(loops).toHaveLength(1);
    expect(loops[0]!.header).toBe(header);
    expect(loops[0]!.kind).toBe("while");
    expect(loops[0]!.backEdges).toEqual([
      { from: continueBlock, to: header },
      { from: bodyBlock, to: header },
    ]);
    expect(loops[0]!.blocks).toEqual([header, continueBlock, bodyBlock]);
    expect(loops[0]!.blocks).not.toContain(deadBlock);
    expect(regions.filter((region) => region.kind === "while")).toHaveLength(1);
  });

  it("keeps the main loop latch when an earlier conditional is also a backedge", () => {
    const { cfg, loops } = analyze([
      abc(Opcode.LOADB, 0, 1, 0),    // pc 0
      ad(Opcode.JUMPIFNOT, 0, 3),    // pc 1 -> pc 5
      ad(Opcode.JUMPIF, 0, -2),      // pc 2 -> pc 1
      ad(Opcode.LOADN, 1, 1),        // pc 3
      ad(Opcode.JUMPBACK, 0, -4),    // pc 4 -> pc 1
      ret(),                         // pc 5
    ]);
    expect(loops).toHaveLength(1);
    expect(loops[0]!.latch).toBe(cfg.blockOfPc.get(4));
    expect(loops[0]!.backEdges).toHaveLength(2);
  });
});
