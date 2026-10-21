import { describe, expect, it } from "vitest";
import { buildControlFlowGraph } from "../src/cfg/ControlFlowGraph.ts";
import { computeDominators } from "../src/cfg/Dominators.ts";
import { findNaturalLoops } from "../src/cfg/NaturalLoops.ts";
import { decodeBytecode } from "../src/decode/Decoder.ts";
import { abc, ad, compile, Opcode, proto, ret, sourceOf } from "./helpers.ts";

function analysis(words: number[]) {
  const bytes = compile(proto({ instructions: words }));
  const { module } = decodeBytecode(bytes, { opcodeEncoding: "official" });
  const cfg = buildControlFlowGraph(module.prototypes[module.mainProtoId]!);
  return { cfg, loops: findNaturalLoops(cfg, computeDominators(cfg)) };
}

describe("natural loop body boundaries", () => {
  it("classifies a repeat whose header branches inside its body using block IDs", () => {
    const words = [
      ad(Opcode.LOADN, 0, 0),       // pc 0: initializer
      ad(Opcode.LOADN, 1, 1),       // pc 1: repeat header
      abc(Opcode.ADD, 0, 0, 1),
      ad(Opcode.LOADN, 2, 2),
      abc(Opcode.MOD, 1, 0, 2),
      ad(Opcode.LOADN, 2, 0),
      ad(Opcode.JUMPIFNOTEQ, 1, 3), 2, // pc 6 -> pc 10 (inside loop)
      ad(Opcode.LOADN, 1, 1),
      abc(Opcode.ADD, 0, 0, 1),
      ad(Opcode.LOADN, 1, 4),       // pc 10: until x >= 4
      ad(Opcode.JUMPIFLE, 1, 2), 0, // pc 11 -> pc 14 exit
      ad(Opcode.JUMPBACK, 0, -13),  // pc 13 -> pc 1
      ret(),
    ];
    const { loops } = analysis(words);
    expect(loops).toHaveLength(1);
    expect(loops[0]).toMatchObject({ kind: "repeat", header: 1, testBlock: 3 });
    // The internal comparison controls a second increment; it is not an
    // `x or fallback` value assignment and must survive reconstruction.
    expect(sourceOf(proto({ instructions: words }))).toContain("% 2");
  });

  it("keeps the one-time preheader out of a reachable self-loop", () => {
    const { cfg, loops } = analysis([
      ad(Opcode.LOADN, 0, 10),        // pc 0: preheader
      ad(Opcode.JUMPBACK, 0, -1),     // pc 1: repeat this block forever
    ]);
    expect(cfg.blocks.map((block) => block.startPc)).toEqual([0, 1]);
    expect(loops).toHaveLength(1);
    expect(loops[0]).toMatchObject({ header: 1, latch: 1, kind: "infinite", blocks: [1] });
    expect(loops[0]!.blocks).not.toContain(0);
  });

  it("ignores unreachable self-loops after a return", () => {
    const { cfg, loops } = analysis([
      ret(),                          // pc 0: the function ends
      ad(Opcode.JUMPBACK, 0, -1),    // pc 1: dead bytecode loop
    ]);
    expect(cfg.blocks[1]!.unreachable).toBe(true);
    expect(loops).toEqual([]);
  });

  it("retains normal while-loop body without the initializer preheader", () => {
    const { loops } = analysis([
      ad(Opcode.LOADN, 0, 3),        // pc 0
      ad(Opcode.JUMPIFNOT, 0, 2),    // pc 1 -> pc 4 exit
      ad(Opcode.LOADN, 1, 9),        // pc 2
      ad(Opcode.JUMPBACK, 0, -3),    // pc 3 -> pc 1
      ret(),                         // pc 4
    ]);
    expect(loops).toHaveLength(1);
    expect(loops[0]!.blocks).toEqual([1, 2]);
    expect(loops[0]!.blocks).not.toContain(0);
    expect(loops[0]!.kind).toBe("while");
  });

  it("does not treat a forward FORGLOOP branch as a synthetic backedge", () => {
    const { loops } = analysis([
      ad(Opcode.FORGLOOP, 0, 2), 2, // pc 0 -> pc 3, not a backward loop edge
      ret(),                        // pc 2
      ret(),                        // pc 3
    ]);
    expect(loops).toEqual([]);
  });
});
