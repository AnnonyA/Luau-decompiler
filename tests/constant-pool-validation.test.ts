import { describe, expect, it } from "vitest";
import { decodeBytecode } from "../src/decode/Decoder.ts";
import { decompile } from "../src/decompile.ts";
import { abc, ad, compile, Opcode, proto, ret, strings } from "./helpers.ts";

describe("constant pool reference validation", () => {
  it("rejects missing LOADK constants instead of reconstructing them as nil", () => {
    const bytes = compile(proto({ instructions: [ad(Opcode.LOADK, 0, 0), ret()] }));
    expect(() => decodeBytecode(bytes, { opcodeEncoding: "official" })).toThrow(
      /LOADK references missing constant 0/,
    );
    const result = decompile(bytes, { opcodeEncoding: "official" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("constant-ref");
    }
  });

  it("rejects invalid LOADKX AUX and GETIMPORT indexes", () => {
    const loadkx = compile(proto({
      constants: strings("hello"),
      instructions: [abc(Opcode.LOADKX, 0), 2, ret()],
    }));
    expect(() => decodeBytecode(loadkx, { opcodeEncoding: "official" })).toThrow(
      /LOADKX references missing constant 2/,
    );

    const imported = compile(proto({
      constants: strings("game"),
      instructions: [ad(Opcode.GETIMPORT, 0, 1), 0x40000000, ret()],
    }));
    expect(() => decodeBytecode(imported, { opcodeEncoding: "official" })).toThrow(
      /GETIMPORT references missing constant 1/,
    );
  });

  it("rejects missing global and duplicated-table constants", () => {
    const global = compile(proto({
      instructions: [abc(Opcode.GETGLOBAL, 0), 0, ret()],
    }));
    expect(() => decodeBytecode(global, { opcodeEncoding: "official" })).toThrow(
      /GETGLOBAL references missing constant 0/,
    );
    const duplicated = compile(proto({
      constants: strings("wrong type"),
      instructions: [ad(Opcode.DUPTABLE, 0, 2), ret()],
    }));
    expect(() => decodeBytecode(duplicated, { opcodeEncoding: "official" })).toThrow(
      /DUPTABLE references missing constant 2/,
    );
  });

  it("rejects DUPCLOSURE with an incorrect constant type or missing child", () => {
    const wrongKind = compile(proto({
      constants: strings("not a closure"),
      instructions: [ad(Opcode.DUPCLOSURE, 0, 0), ret()],
    }));
    expect(() => decodeBytecode(wrongKind, { opcodeEncoding: "official" })).toThrow(
      /DUPCLOSURE expected a closure constant/,
    );
    const missingChild = compile(proto({
      constants: [{ kind: "closure", protoId: 99 }],
      instructions: [ad(Opcode.DUPCLOSURE, 0, 0), ret()],
    }));
    expect(() => decodeBytecode(missingChild, { opcodeEncoding: "official" })).toThrow(
      /DUPCLOSURE references missing prototype 99/,
    );
  });

  it("keeps valid constant-bearing instructions compatible", () => {
    const bytes = compile(proto({
      constants: strings("hello"),
      instructions: [ad(Opcode.LOADK, 0, 0), abc(Opcode.RETURN, 0, 2, 0)],
    }));
    const result = decompile(bytes, { opcodeEncoding: "official" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.source).toContain('"hello"');
    }
  });
});
