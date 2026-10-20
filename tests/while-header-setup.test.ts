import { describe, expect, it } from "vitest";
import { buildControlFlowGraph } from "../src/cfg/ControlFlowGraph.ts";
import { computeDominators } from "../src/cfg/Dominators.ts";
import { findNaturalLoops } from "../src/cfg/NaturalLoops.ts";
import { decodeBytecode } from "../src/decode/Decoder.ts";
import { decompile } from "../src/decompile.ts";
import { abc, ad, compile, Opcode, proto, ret } from "./helpers.ts";

// Compiled by the pinned official luau-compile with --binary -O0 -g1 from
// benchmarks/semantic/loop.luau. The original prints "loop\t15\n".
// This bytecode uses LOADK + JUMPIFNOTLE at the loop header, and
// ADD/LOADK/ADD/JUMPBACK in its body.
const actualWhile = Buffer.from(
  "DgMCBXByaW50BGxvb3AAAYMBBQAAAQgAEEEAAAAFAAAABQEBAAUCAgAfAQUAAgAAACEAAAEFAgEAIQEBAhgA+f8HAgBGAwAAAAUDBAAGBAAAFQIDARYAAQAFAgAAAAAAAAAAAgAAAAAAAPA/AgAAAAAAABRAAwEDAgABAAEYAAABAQAAAQEA/gQAAAAAAQEAAAAAAAwA",
  "base64",
);

function loopsFrom(bytes: Uint8Array) {
  const { module } = decodeBytecode(bytes, { opcodeEncoding: "official" });
  const prototype = module.prototypes[module.mainProtoId]!;
  const cfg = buildControlFlowGraph(prototype);
  return { cfg, loops: findNaturalLoops(cfg, computeDominators(cfg)) };
}

describe("while header setup and loop body recovery", () => {
  it("recognizes the real compiler's LOADK + conditional test as a while", () => {
    const { cfg, loops } = loopsFrom(actualWhile);
    expect(loops).toHaveLength(1);
    expect(loops[0]!.kind).toBe("while");
    expect(loops[0]!.blocks).toEqual([1, 2]);
    expect(cfg.blocks[1]!.instructions.map((insn) => insn.opcode)).toEqual([
      Opcode.LOADK, Opcode.JUMPIFNOTLE,
    ]);
    expect(cfg.blocks[2]!.instructions.some((insn) => insn.opcode === Opcode.ADD)).toBe(true);
  });

  it("does not silently drop two in-loop additions when reconstructing real bytecode", () => {
    const result = decompile(actualWhile, { opcodeEncoding: "official" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.validation).toEqual([]);
    expect(result.source).toContain("while ");
    expect(result.source).not.toContain("repeat");
    expect(result.source).toMatch(/while [^\n]+ <= 5 do/);
    expect(result.source).toContain('print("loop",');
    expect((result.source.match(/\+=|= [^\n]+ \+/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("continues to recognize a repeat with a real test in its header and a control-only latch", () => {
    const { loops } = loopsFrom(compile(proto({
      instructions: [
        ad(Opcode.LOADN, 0, 1),
        ad(Opcode.JUMPIFNOT, 0, 1),
        ad(Opcode.JUMPBACK, 0, -3),
        ret(),
      ],
    })));
    expect(loops).toHaveLength(1);
    expect(loops[0]!.kind).toBe("repeat");
  });
});
