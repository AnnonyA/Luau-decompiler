import { describe, expect, it } from "vitest";
import { decompile } from "../src/decompile.ts";
import { writeBytecode } from "../src/decode/BytecodeWriter.ts";
import { abc, ad, CaptureType, compile, importConst, Opcode, proto, strings } from "./helpers.ts";

describe("indexed instruction window scans", () => {
  const captureReader = () => proto({
    numUpvalues: 1,
    instructions: [
      abc(Opcode.GETUPVAL, 0, 0, 0),
      abc(Opcode.RETURN, 0, 2, 0),
    ],
  });

  it("resolves both separated closures after a long instruction prefix", () => {
    const main = proto({
      maxStackSize: 8,
      children: [captureReader(), captureReader()],
      instructions: [
        ...Array.from({ length: 96 }, () => abc(Opcode.NOP, 0, 0, 0)),
        ad(Opcode.LOADN, 3, 7),
        ad(Opcode.NEWCLOSURE, 0, 0),
        abc(Opcode.CAPTURE, CaptureType.VAL, 3, 0),
        ad(Opcode.LOADN, 4, 9),
        ad(Opcode.NEWCLOSURE, 1, 1),
        abc(Opcode.CAPTURE, CaptureType.VAL, 4, 0),
        abc(Opcode.RETURN, 0, 3, 0),
      ],
    });
    const result = decompile(compile(main), { opcodeEncoding: "official" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.validation).toEqual([]);
      expect(result.source.match(/function\(/g)).toHaveLength(2);
      expect(result.source).toContain("return 7");
      expect(result.source).toContain("return 9");
    }
  });

  it("handles a DUPCLOSURE with a contiguous capture after unrelated instructions", () => {
    const main = proto({
      maxStackSize: 4,
      children: [captureReader()],
      constants: [{ kind: "closure", protoId: 0 }],
      instructions: [
        ...Array.from({ length: 32 }, () => abc(Opcode.NOP, 0, 0, 0)),
        ad(Opcode.LOADN, 2, 13),
        ad(Opcode.DUPCLOSURE, 0, 0),
        abc(Opcode.CAPTURE, CaptureType.VAL, 2, 0),
        abc(Opcode.RETURN, 0, 2, 0),
      ],
    });
    const result = decompile(compile(main), { opcodeEncoding: "official" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.validation).toEqual([]);
      expect(result.source).toContain("return 13");
    }
  });

  it("does not duplicate FASTPCALL fallback calls with a long prefix", () => {
    const main = proto({
      maxStackSize: 4,
      constants: [...strings("pcall", "print", "hello"), importConst(["pcall"]), importConst(["print"])],
      instructions: [
        ...Array.from({ length: 96 }, () => abc(Opcode.NOP, 0, 0, 0)),
        ad(Opcode.GETIMPORT, 0, 3),
        0x40000000,
        ad(Opcode.GETIMPORT, 1, 4),
        0x40100000,
        ad(Opcode.LOADK, 2, 2),
        abc(Opcode.FASTPCALL, 0, 1, 0),
        abc(Opcode.CALL, 0, 3, 2),
        abc(Opcode.RETURN, 0, 2, 0),
      ],
    });
    const bytes = writeBytecode(main, { version: 14, typesVersion: 1 });
    const result = decompile(bytes, { opcodeEncoding: "official" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.validation).toEqual([]);
      expect(result.source.match(/pcall\(/g)).toHaveLength(1);
      expect(result.source).toContain('"hello"');
    }
  });
});
