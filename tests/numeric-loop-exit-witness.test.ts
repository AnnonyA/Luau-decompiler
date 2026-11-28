import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {expect, it} from "vitest";
import {decodeBytecode} from "../src/decode/Decoder.ts";
import {decompile} from "../src/decompile.ts";
import {analyzePrototype} from "../src/reconstruct/Reconstructor.ts";

it("joins both exits of a numeric-for whose FORNLOOP is unreachable", () => {
  const bytes = readFileSync(new URL("fixtures/numeric-loop-exit-witness/inline-loop-exit.O2g2.luac", import.meta.url));
  expect(createHash("sha256").update(bytes).digest("hex"))
    .toBe("027d05519b0d7df7571e3ced6883e2db34ce4ca7deabd178a09f205e9fb09a5f");
  const {module} = decodeBytecode(bytes, {opcodeEncoding: "official"});
  const observe = module.prototypes.find(proto => proto.debugName === "observe")!;
  const ir = analyzePrototype(observe);
  const loop = ir.loops.find(region => region.kind === "numeric-for")!;
  expect(ir.cfg.blocks[loop.latch]!.unreachable).toBe(true);
  // Successful entry runs the body and jumps to PC 8; zero trips execute
  // the fallback assignment at PC 7 first. The table key is live at PC 8.
  expect(ir.cfg.blocks[ir.cfg.blocks[loop.latch]!.fallthrough!]!.startPc).toBe(7);
  expect(ir.cfg.blocks[ir.structure.loopFollowByLoop.get(loop)!]!.startPc).toBe(8);

  const result = decompile(bytes, {opcodeEncoding: "official"});
  if (!result.ok) throw Error(result.error);
  expect(result.validation).toEqual([]);
  expect(result.source).toContain("key = value + i");
  expect(result.source).toMatch(/if runTail then\s+key = -7\s+end/);
  expect(result.source).toContain("{ [key] = value }");
});
