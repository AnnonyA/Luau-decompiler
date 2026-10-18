import { describe, expect, it } from "vitest";
import { decompile } from "../src/decompile.ts";
import { decodeBytecode } from "../src/decode/Decoder.ts";
import { Opcode, isFastCall, jumpTarget, opcodeDescriptor } from "../src/decode/Opcode.ts";
import { writeBytecode } from "../src/decode/BytecodeWriter.ts";
import { abc, ad, proto, ret, strings, importConst } from "./helpers.ts";

describe("modern Luau bytecode", () => {
  it.each([10, 11, 12, 13, 14])("round-trips version %i prototype framing and extensions", (version) => {
    const bytes = writeBytecode(proto({ instructions: [ret()] }), { version, typesVersion: 1 });
    const result = decodeBytecode(bytes, { opcodeEncoding: "official" });
    expect(result.module.version).toBe(version);
    expect(result.module.prototypes).toHaveLength(1);
    expect(result.module.prototypes[0]!.instructions[0]!.mnemonic).toBe("RETURN");
    expect(result.module.prototypes[0]!.feedback).toEqual([]);
  });

  it("decodes version 13 precise 64-bit vector constants", () => {
    const value = 123.123456789;
    const bytes = writeBytecode(
      proto({
        instructions: [ret()],
        constants: [{ kind: "vector", x: value, y: 0.5, z: -3.25, precise: true }],
      }),
      { version: 13, typesVersion: 1 },
    );
    const result = decodeBytecode(bytes);
    expect(result.module.prototypes[0]!.constants[0]).toMatchObject({
      kind: "vector",
      x: value,
      precise: true,
    });
  });

  it("decodes cost-model prototype flag in version 14", () => {
    const bytes = writeBytecode(proto({ instructions: [ret()], flags: 8 }), { version: 14, typesVersion: 1 });
    const result = decodeBytecode(bytes);
    expect(result.module.prototypes[0]!.cost).toBe(0n);
  });

  it("recognizes FASTPCALL and decompiles its CALL fallback without a duplicate invocation", () => {
    expect(opcodeDescriptor(Opcode.FASTPCALL)?.introducedIn).toBe(14);
    expect(isFastCall(Opcode.FASTPCALL)).toBe(true);
    const instructions = [
      ad(Opcode.GETIMPORT, 0, 3),
      0x40000000,
      ad(Opcode.GETIMPORT, 1, 4),
      0x40100000,
      ad(Opcode.LOADK, 2, 2),
      abc(Opcode.FASTPCALL, 0, 1, 0),
      abc(Opcode.CALL, 0, 3, 2),
      abc(Opcode.RETURN, 0, 2, 0),
    ];
    const fixture = proto({
      maxStackSize: 4,
      constants: [...strings("pcall", "print", "hello"), importConst(["pcall"]), importConst(["print"])],
      instructions,
    });
    const bytes = writeBytecode(fixture, { version: 14, typesVersion: 1 });
    const result = decodeBytecode(bytes, { opcodeEncoding: "official" });
    expect(result.profile.status).toBe("experimental");
    expect(result.module.prototypes[0]!.instructions.map((insn) => insn.mnemonic)).toContain("FASTPCALL");
    expect(result.module.prototypes[0]!.instructions[4]!.jumpTarget).toBe(7);
    expect(jumpTarget(instructions[5]!, 5)).toBe(7);

    const reconstructed = decompile(bytes, { opcodeEncoding: "official" });
    expect(reconstructed.ok).toBe(true);
    if (reconstructed.ok) {
      expect(reconstructed.source).toContain("pcall(");
      expect((reconstructed.source.match(/pcall\(/g) ?? [])).toHaveLength(1);
      expect(reconstructed.source).toContain('"hello"');
    }
  });

  it("rejects the FASTPCALL opcode in bytecode versions before 14", () => {
    const bytes = writeBytecode(
      proto({ instructions: [abc(Opcode.FASTPCALL, 0, 0, 0), ret()] }),
      { version: 13, typesVersion: 1 },
    );
    expect(() => decodeBytecode(bytes, { opcodeEncoding: "official" })).toThrow(
      /FASTPCALL.*not valid for bytecode version 13/,
    );
  });
});
