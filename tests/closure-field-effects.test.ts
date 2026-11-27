import { describe, expect, it } from "vitest";
import type { WrittenConstant } from "../src/decode/BytecodeWriter.ts";
import { ClosureEffects } from "../src/reconstruct/ClosureEffects.ts";
import { analyzePrototype } from "../src/reconstruct/Reconstructor.ts";
import { abc, ad, CaptureType, decode, Opcode, proto, ret } from "./helpers.ts";

function fieldEffects(extra: number[] = [], integerField = false) {
  const callback = proto({
    numUpvalues: 1,
    constants: [{ kind: "string", value: "opaque" }],
    instructions: [
      abc(Opcode.GETUPVAL, 1, 0), abc(Opcode.GETGLOBAL, 0), 0,
      abc(Opcode.CALL, 0, 2, 1), ret(),
    ],
  });
  const metamethod = proto({ instructions: [ad(Opcode.LOADN, 0, 1), abc(Opcode.RETURN, 0, 2)] });
  const constants: WrittenConstant[] = [
    { kind: "string", value: "count" }, { kind: "number", value: 1 },
    { kind: "string", value: "published" }, { kind: "string", value: "__add" },
    { kind: "string", value: "setmetatable" }, { kind: "closure", protoId: 1 },
  ];
  const store = integerField ? [abc(Opcode.SETTABLEN, 1, 0, 0)] : [abc(Opcode.SETTABLEKS, 1, 0), 0];
  const read = integerField ? [abc(Opcode.GETTABLEN, 10, 0, 0)] : [abc(Opcode.GETTABLEKS, 10, 0), 0];
  const module = decode(proto({
    maxStackSize: 12, isVararg: true, children: [callback, metamethod], constants,
    instructions: [
      abc(Opcode.NEWTABLE, 0), 1, ad(Opcode.LOADN, 1, 7), ...store,
      ad(Opcode.NEWCLOSURE, 2, 0), abc(Opcode.CAPTURE, CaptureType.VAL, 0),
      ...extra, ...read, abc(Opcode.ADDK, 11, 10, 1), abc(Opcode.RETURN, 11, 2),
    ],
  })).module;
  const main = module.prototypes[module.mainProtoId]!;
  const ir = analyzePrototype(main);
  return {
    effects: new ClosureEffects(module, main, ir.cfg, ir.ssa),
    read: main.instructions.find(instruction => instruction.a === 10 &&
      (instruction.opcode === Opcode.GETTABLEKS || instruction.opcode === Opcode.GETTABLEN))!,
    add: main.instructions.find(instruction => instruction.opcode === Opcode.ADDK)!,
  };
}

describe("captured private table field effect proofs", () => {
  it("keeps a numeric field proof while its capturing local closure is uncalled and unescaped", () => {
    const { effects, read, add } = fieldEffects();
    expect(effects.neutral(read, false)).toBe(true);
    expect(effects.neutral(add, false)).toBe(true);
  });

  it("ends privacy after the capturing callback is called through a MOVE alias", () => {
    const { effects, read, add } = fieldEffects([abc(Opcode.MOVE, 3, 2), abc(Opcode.CALL, 3, 1, 1)]);
    expect(effects.neutral(read, false)).toBe(false);
    expect(effects.neutral(add, false)).toBe(false);
  });

  it("ends privacy when the capturing callback escapes through a global", () => {
    const { effects, read, add } = fieldEffects([abc(Opcode.SETGLOBAL, 2), 2]);
    expect(effects.neutral(read, false)).toBe(false);
    expect(effects.neutral(add, false)).toBe(false);
  });

  it("ends privacy when a phi may select the capturing callback before a call", () => {
    const { effects, read, add } = fieldEffects([
      abc(Opcode.GETVARARGS, 3, 2), ad(Opcode.JUMPIFNOT, 3, 2),
      abc(Opcode.MOVE, 4, 2), ad(Opcode.JUMP, 0, 1), abc(Opcode.LOADNIL, 4),
      abc(Opcode.CALL, 4, 1, 1),
    ]);
    expect(effects.neutral(read, false)).toBe(false);
    expect(effects.neutral(add, false)).toBe(false);
  });

  it("ends privacy when a phi may publish the table itself", () => {
    const { effects, read, add } = fieldEffects([
      abc(Opcode.GETVARARGS, 3, 2), ad(Opcode.JUMPIFNOT, 3, 2),
      abc(Opcode.MOVE, 4, 0), ad(Opcode.JUMP, 0, 1), abc(Opcode.LOADNIL, 4),
      abc(Opcode.SETGLOBAL, 4), 2,
    ]);
    expect(effects.neutral(read, false)).toBe(false);
    expect(effects.neutral(add, false)).toBe(false);
  });

  it("does not retain a numeric fact after count is replaced by an object with __add", () => {
    const { effects, read, add } = fieldEffects([
      abc(Opcode.NEWTABLE, 3), 0, abc(Opcode.NEWTABLE, 4), 0,
      ad(Opcode.DUPCLOSURE, 5, 5), abc(Opcode.SETTABLEKS, 5, 4), 3,
      abc(Opcode.GETGLOBAL, 5), 4, abc(Opcode.MOVE, 6, 3), abc(Opcode.MOVE, 7, 4),
      abc(Opcode.CALL, 5, 3, 2), abc(Opcode.SETTABLEKS, 5, 0), 0,
    ]);
    expect(effects.neutral(read, false)).toBe(true);
    expect(effects.neutral(add, false)).toBe(false);
  });

  it("requires numeric field values on both incoming CFG paths", () => {
    const { effects, add } = fieldEffects([
      abc(Opcode.GETVARARGS, 3, 2), ad(Opcode.JUMPIFNOT, 3, 4),
      abc(Opcode.NEWTABLE, 4), 0, abc(Opcode.SETTABLEKS, 4, 0), 0,
    ]);
    expect(effects.neutral(add, false)).toBe(false);
  });

  it("invalidates a numeric integer field overwritten by SETLIST with an object", () => {
    const { effects, read, add } = fieldEffects([
      abc(Opcode.NEWTABLE, 3), 0, abc(Opcode.SETLIST, 0, 3, 2), 1,
    ], true);
    expect(effects.neutral(read, false)).toBe(true);
    expect(effects.neutral(add, false)).toBe(false);
  });
});
