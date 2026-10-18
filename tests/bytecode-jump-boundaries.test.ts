import { describe, expect, it } from "vitest";
import { BytecodeError } from "../src/decode/BytecodeError.ts";
import { decodeBytecode } from "../src/decode/Decoder.ts";
import { abc, ad, compile, Opcode, proto, ret, strings } from "./helpers.ts";

describe("bytecode jump instruction boundaries", () => {
  it("rejects an ordinary jump into an AUX word", () => {
    const bytes = compile(proto({
      instructions: [
        ad(Opcode.JUMP, 0, 1), // 0 -> 2, inside GETGLOBAL's AUX
        abc(Opcode.GETGLOBAL, 0, 0, 0),
        0,
        ret(),
      ],
    }));
    expect(() => decodeBytecode(bytes, { opcodeEncoding: "official" })).toThrow(
      /jumps to pc 2 inside an instruction's AUX word/,
    );
    try {
      decodeBytecode(bytes, { opcodeEncoding: "official" });
      throw new Error("expected a rejected jump");
    } catch (error) {
      expect(error).toBeInstanceOf(BytecodeError);
      expect((error as BytecodeError).code).toBe("jump-boundary");
    }
  });

  it("rejects LOADB skip targets in the middle of an instruction", () => {
    const bytes = compile(proto({
      instructions: [
        abc(Opcode.LOADB, 0, 1, 1), // 0 -> 2, AUX of GETTABLEKS
        abc(Opcode.GETTABLEKS, 1, 0, 0),
        0,
        ret(),
      ],
    }));
    expect(() => decodeBytecode(bytes, { opcodeEncoding: "official" })).toThrow(/AUX word/);
  });

  it("accepts a jump over an entire AUX-bearing instruction", () => {
    const result = decodeBytecode(compile(proto({
      constants: strings("validGlobal"),
      instructions: [
        ad(Opcode.JUMP, 0, 2), // pc 0 -> pc 3, a real instruction
        abc(Opcode.GETGLOBAL, 0, 0, 0),
        0,
        ret(),
      ],
    })), { opcodeEncoding: "official" });
    expect(result.module.prototypes[0]!.instructions[0]!.jumpTarget).toBe(3);
  });

  it("accepts a jump to the end of the code stream", () => {
    const result = decodeBytecode(compile(proto({
      instructions: [ad(Opcode.JUMP, 0, 1), ret()],
    })), { opcodeEncoding: "official" });
    expect(result.module.prototypes[0]!.instructions[0]!.jumpTarget).toBe(2);
  });

  it("preserves a valid optimized FASTCALL3 skip immediately after AUX", () => {
    const result = decodeBytecode(compile(proto({
      instructions: [
        abc(Opcode.FASTCALL3, 1, 0, 0), 0, // 0 -> 2
        abc(Opcode.CALL, 0, 1, 2),
        ret(),
      ],
    })), { opcodeEncoding: "official" });
    expect(result.module.prototypes[0]!.instructions[0]!.jumpTarget).toBe(2);
  });
});
