import { describe, expect, it } from "vitest";
import { decodeBytecode } from "../src/decode/Decoder.ts";
import { abc, ad, CaptureType, compile, Opcode, proto, ret } from "./helpers.ts";

function childWithUpvalues(count: number) {
  return proto({ numUpvalues: count, instructions: [ret()] });
}

describe("closure capture validation", () => {
  it("accepts the exact number of captures for a nested closure", () => {
    const { module } = decodeBytecode(compile(proto({
      maxStackSize: 3,
      numUpvalues: 1,
      upvalueNames: ["outer"],
      children: [childWithUpvalues(2)],
      instructions: [
        ad(Opcode.LOADN, 0, 7),
        ad(Opcode.NEWCLOSURE, 1, 0),
        abc(Opcode.CAPTURE, CaptureType.VAL, 0),
        abc(Opcode.CAPTURE, CaptureType.UPVAL, 0),
        ret(),
      ],
    })));
    const main = module.prototypes[module.mainProtoId]!;
    expect(main.instructions.map((insn) => insn.mnemonic)).toEqual([
      "LOADN", "NEWCLOSURE", "CAPTURE", "CAPTURE", "RETURN",
    ]);
  });

  it("accepts DUPCLOSURE capture lists in real-world bytecode layouts", () => {
    const { module } = decodeBytecode(compile(proto({
      children: [childWithUpvalues(1)],
      constants: [{ kind: "closure", protoId: 0 }],
      instructions: [
        ad(Opcode.DUPCLOSURE, 1, 0),
        abc(Opcode.CAPTURE, CaptureType.VAL, 0),
        ret(),
      ],
    })));
    expect(module.prototypes[module.mainProtoId]!.instructions.map((insn) => insn.mnemonic)).toEqual([
      "DUPCLOSURE", "CAPTURE", "RETURN",
    ]);
  });

  it("rejects a NEWCLOSURE with too few captures", () => {
    const bytecode = compile(proto({
      children: [childWithUpvalues(2)],
      instructions: [
        ad(Opcode.NEWCLOSURE, 0, 0),
        abc(Opcode.CAPTURE, CaptureType.VAL, 1),
        ret(),
      ],
    }));
    expect(() => decodeBytecode(bytecode)).toThrow(/requires 2 CAPTURE instruction/);
  });

  it("rejects extra or detached CAPTURE instructions", () => {
    const extra = compile(proto({
      children: [childWithUpvalues(1)],
      instructions: [
        ad(Opcode.NEWCLOSURE, 0, 0),
        abc(Opcode.CAPTURE, CaptureType.VAL, 1),
        abc(Opcode.CAPTURE, CaptureType.REF, 1),
        ret(),
      ],
    }));
    expect(() => decodeBytecode(extra)).toThrow(/orphan CAPTURE/);
    expect(() => decodeBytecode(compile(proto({
      instructions: [abc(Opcode.CAPTURE, CaptureType.VAL, 0), ret()],
    })))).toThrow(/orphan CAPTURE/);
  });

  it("rejects invalid capture kinds and registers", () => {
    const make = (kind: number, source: number) => compile(proto({
      maxStackSize: 2,
      children: [childWithUpvalues(1)],
      instructions: [
        ad(Opcode.NEWCLOSURE, 0, 0),
        abc(Opcode.CAPTURE, kind as CaptureType, source),
        ret(),
      ],
    }));
    expect(() => decodeBytecode(make(3, 0))).toThrow(/invalid CAPTURE kind 3/);
    expect(() => decodeBytecode(make(CaptureType.REF, 2))).toThrow(/register 2 outside limit 2/);
  });

  it("rejects captures of upvalues absent from the parent prototype", () => {
    const bytecode = compile(proto({
      numUpvalues: 0,
      children: [childWithUpvalues(1)],
      instructions: [
        ad(Opcode.NEWCLOSURE, 0, 0),
        abc(Opcode.CAPTURE, CaptureType.UPVAL, 0),
        ret(),
      ],
    }));
    expect(() => decodeBytecode(bytecode)).toThrow(/upvalue 0 outside limit 0/);
  });
});
