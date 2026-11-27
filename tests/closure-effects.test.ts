import { describe, expect, it } from "vitest";
import { ClosureEffects } from "../src/reconstruct/ClosureEffects.ts";
import { analyzePrototype } from "../src/reconstruct/Reconstructor.ts";
import { abc, ad, decode, Opcode, proto, ret } from "./helpers.ts";

function tableCall(mode: "untouched" | "same-block" | "other-block" | "other-block-alias") {
  const value = proto({ instructions: [ret()] });
  const quiet = proto({ numParams: 1, instructions: [ret()] });
  const effectful = proto({
    numParams: 1, constants: [{ kind: "string", value: "setfenv" }],
    instructions: [
      abc(Opcode.GETGLOBAL, 1), 0, abc(Opcode.MOVE, 2, 0), abc(Opcode.NEWTABLE, 3), 0,
      abc(Opcode.CALL, 1, 3, 1), ret(),
    ],
  });
  const writes: number[] = [];
  if (mode === "other-block-alias") writes.push(abc(Opcode.MOVE, 4, 3));
  if (mode === "other-block" || mode === "other-block-alias") writes.push(ad(Opcode.JUMPIFNOT, 0, 1));
  if (mode !== "untouched") writes.push(abc(Opcode.SETTABLEN, 2, mode === "other-block-alias" ? 4 : 3, 0));
  const module = decode(proto({
    numParams: 1,
    children: [value, quiet, effectful],
    constants: [{ kind: "closure", protoId: 0 }, { kind: "closure", protoId: 1 }, { kind: "closure", protoId: 2 }],
    instructions: [
      ad(Opcode.DUPCLOSURE, 1, 1), ad(Opcode.DUPCLOSURE, 2, 2),
      abc(Opcode.NEWTABLE, 3), 1, abc(Opcode.MOVE, 4, 1), abc(Opcode.SETLIST, 3, 4, 2), 1,
      ad(Opcode.DUPCLOSURE, 5, 0), ...writes,
      abc(Opcode.GETTABLEN, 6, 3, 0), abc(Opcode.MOVE, 7, 5), abc(Opcode.CALL, 6, 2, 1),
      ad(Opcode.DUPCLOSURE, 6, 0), abc(Opcode.RETURN, 5, 3),
    ],
  })).module;
  const main = module.prototypes[module.mainProtoId]!;
  const ir = analyzePrototype(main);
  return {
    effects: new ClosureEffects(module, main, ir.cfg, ir.ssa),
    call: main.instructions.find(instruction => instruction.opcode === Opcode.CALL)!,
  };
}

describe("closure environment effect proofs", () => {
  it("recognizes the unchanged pure closure in a private constructor", () => {
    const { effects, call } = tableCall("untouched");
    expect(effects.neutral(call, false)).toBe(true);
  });

  it("uses a later same-block overwrite instead of the original constructor value", () => {
    const { effects, call } = tableCall("same-block");
    expect(effects.neutral(call, false)).toBe(false);
  });

  it("does not call a stale constructor value pure after a write in another CFG block", () => {
    const { effects, call } = tableCall("other-block");
    expect(effects.neutral(call, false)).toBe(false);
  });

  it("detects a write through a MOVE alias in another CFG block", () => {
    const { effects, call } = tableCall("other-block-alias");
    expect(effects.neutral(call, false)).toBe(false);
  });
});
