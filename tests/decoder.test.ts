import { describe, expect, it } from "vitest";
import { decodeBytecode } from "../src/decode/Decoder.ts";
import { BytecodeError } from "../src/decode/BytecodeError.ts";
import { abc, ad, Opcode, compile, decode, proto, ret, strings, importConst } from "./helpers.ts";
import { instructionWidth, jumpTarget } from "../src/decode/Opcode.ts";
import { writeBytecode } from "../src/decode/BytecodeWriter.ts";

describe("decoder", () => {
  it("rejects empty input", () => {
    expect(() => decodeBytecode(new Uint8Array())).toThrow(BytecodeError);
  });

  it("rejects truncated headers", () => {
    expect(() => decodeBytecode(new Uint8Array([6]))).toThrow(/expected 1 more byte|truncated|string count/i);
  });

  it("surfaces version 0 compiler errors", () => {
    const payload = new TextEncoder().encode("\0syntax error: expected 'end'");
    try {
      decodeBytecode(payload);
      throw new Error("expected failure");
    } catch (error) {
      expect(error).toBeInstanceOf(BytecodeError);
      expect((error as BytecodeError).code).toBe("compile-error");
      expect((error as BytecodeError).message).toContain("syntax error");
    }
  });

  it("rejects unsupported historic versions", () => {
    expect(() => decodeBytecode(new Uint8Array([1, 0]))).toThrow(/versions 1-2/i);
  });

  it("rejects unknown opcodes", () => {
    const bytecode = compile(
      proto({
        instructions: [abc(200 as Opcode, 0, 0, 0), ret()],
      }),
    );
    expect(() => decodeBytecode(bytecode)).toThrow(/unknown opcode/);
  });

  it("refuses to desynchronize on a missing AUX word", () => {
    expect(() =>
      decodeBytecode(
        compile(
          proto({
            instructions: [abc(Opcode.GETGLOBAL, 0, 0, 0)],
          }),
        ),
      ),
    ).toThrow(/AUX/);
  });

  it("round-trips a function with constants, imports and AUX", () => {
    const bytecode = compile(
      proto({
        maxStackSize: 3,
        constants: [...strings("print", "hello"), importConst(["print"])],
        instructions: [
          ad(Opcode.GETIMPORT, 0, 2),
          0x80000000,
          ad(Opcode.LOADK, 1, 1),
          abc(Opcode.CALL, 0, 2, 1),
          ret(),
        ],
      }),
    );
    const { module, profile } = decodeBytecode(bytecode);
    expect(profile.status).toBe("verified");
    expect(module.version).toBe(6);
    expect(module.prototypes).toHaveLength(1);
    const main = module.prototypes[0]!;
    expect(main.constants.map((constant) => constant.kind)).toEqual(["string", "string", "import"]);
    expect(main.constants[2]).toMatchObject({ kind: "import", path: ["print"] });
    expect(main.instructions.map((insn) => insn.mnemonic)).toEqual(["GETIMPORT", "LOADK", "CALL", "RETURN"]);
    expect(main.instructions[0]?.width).toBe(2);
    expect(main.instructions[0]?.aux).toBe(0x80000000);
    expect(main.instructions[2]?.call).toEqual({
      functionRegister: 0,
      argumentBase: 1,
      argumentCount: 1,
      resultCount: 0,
    });
  });

  it("decodes nested prototypes and captures", () => {
    const child = proto({
      numParams: 0,
      numUpvalues: 1,
      upvalueNames: ["n"],
      instructions: [abc(Opcode.GETUPVAL, 0, 0, 0), abc(Opcode.RETURN, 0, 2, 0)],
    });
    const { module } = decode(
      proto({
        maxStackSize: 2,
        locals: [{ name: "n", startPc: 1, endPc: 4, register: 0 }],
        children: [child],
        constants: [{ kind: "number", value: 1 }],
        instructions: [
          ad(Opcode.LOADN, 0, 1),
          ad(Opcode.NEWCLOSURE, 1, 0),
          abc(Opcode.CAPTURE, 1, 0, 0),
          ret(),
        ],
      }),
    );
    expect(module.prototypes).toHaveLength(2);
    const parent = module.prototypes[module.mainProtoId]!;
    expect(parent.childProtoIds).toHaveLength(1);
    expect(parent.instructions.map((insn) => insn.mnemonic)).toEqual(["LOADN", "NEWCLOSURE", "CAPTURE", "RETURN"]);
    expect(parent.instructions[2]?.capture).toEqual({ type: 1, source: 0 });
  });

  it("validates jump destinations", () => {
    expect(() =>
      decode(
        proto({
          instructions: [ad(Opcode.JUMP, 0, 40), ret()],
        }),
      ),
    ).toThrow(/jumps outside/);
  });

  it("decodes comparison jumps with AUX as the second register", () => {
    const { module } = decode(
      proto({
        instructions: [ad(Opcode.JUMPIFEQ, 0, 1), 1, ret()],
      }),
    );
    const insn = module.prototypes[0]!.instructions[0]!;
    expect(insn.width).toBe(2);
    expect(insn.uses).toEqual([0, 1]);
    expect(jumpTarget(insn.rawWord, insn.pc)).toBe(2);
  });

  it("keeps instruction widths aligned with official AUX-bearing opcodes", () => {
    expect(instructionWidth(Opcode.GETGLOBAL)).toBe(2);
    expect(instructionWidth(Opcode.FASTCALL3)).toBe(2);
    expect(instructionWidth(Opcode.NEWCLOSURE)).toBe(1);
    expect(instructionWidth(Opcode.CAPTURE)).toBe(1);
    expect(instructionWidth(Opcode.CALL)).toBe(1);
  });

  it("decodes vector, integer and table constants", () => {
    const { module } = decodeBytecode(
      writeBytecode(
        proto({
          constants: [
            { kind: "nil" },
            { kind: "boolean", value: true },
            { kind: "vector", x: 1, y: 2, z: 3 },
            { kind: "integer", value: 99n },
            { kind: "table", keys: [1] },
          ],
          instructions: [ret()],
        }),
      ),
    );
    expect(module.prototypes[0]!.constants.map((constant) => constant.kind)).toEqual([
      "nil",
      "boolean",
      "vector",
      "integer",
      "table",
    ]);
  });

  it("enforces safety limits", () => {
    expect(() => decodeBytecode(compile(proto({ instructions: [ret()] })), { limits: { maxBytecodeBytes: 2 } })).toThrow(
      /exceeds limit/,
    );
  });
});
