import { describe, expect, it } from "vitest";
import { decodeBytecode } from "../src/decode/Decoder.ts";
import { decompile } from "../src/decompile.ts";
import { abc, ad, compile, Opcode, proto, ret, strings } from "./helpers.ts";

const official = { opcodeEncoding: "official" as const };

describe("constant operands in arithmetic and field bytecode", () => {
  it.each([
    [Opcode.ADDK, 1, 0],
    [Opcode.SUBK, 1, 0],
    [Opcode.MULK, 1, 0],
    [Opcode.DIVK, 1, 0],
    [Opcode.MODK, 1, 0],
    [Opcode.POWK, 1, 0],
    [Opcode.IDIVK, 1, 0],
    [Opcode.ANDK, 1, 0],
    [Opcode.ORK, 1, 0],
    [Opcode.SUBRK, 0, 1],
    [Opcode.DIVRK, 0, 1],
  ])("rejects a missing constant for arithmetic opcode %i", (opcode, b, c) => {
    const bytes = compile(proto({
      instructions: [abc(opcode, 0, b, c), ret()],
    }));
    expect(() => decodeBytecode(bytes, official)).toThrow(/references missing constant 0/);
  });

  it.each([
    [Opcode.GETTABLEKS, 0, 1],
    [Opcode.SETTABLEKS, 0, 1],
    [Opcode.NAMECALL, 0, 1],
  ])("rejects missing string-key AUX constants for opcode %i", (opcode, a, b) => {
    const bytes = compile(proto({
      instructions: [abc(opcode, a, b, 0), 2, ret()],
      constants: strings("existing"),
    }));
    expect(() => decodeBytecode(bytes, official)).toThrow(/references missing constant 2/);
  });

  it("validates the constant index used in conditional comparisons", () => {
    for (const opcode of [Opcode.JUMPXEQKN, Opcode.JUMPXEQKS]) {
      const bytes = compile(proto({
        constants: strings("one"),
        instructions: [ad(opcode, 0, 1), 2, ret()],
      }));
      expect(() => decodeBytecode(bytes, official)).toThrow(/references missing constant 2/);
    }
  });

  it("rejects non-string keys in property/method/global instructions", () => {
    const constants = [{ kind: "number" as const, value: 7 }];
    for (const opcode of [Opcode.GETGLOBAL, Opcode.SETGLOBAL, Opcode.GETTABLEKS, Opcode.SETTABLEKS, Opcode.NAMECALL]) {
      const bytes = compile(proto({
        constants,
        instructions: [abc(opcode, 0, 1, 0), 0, ret()],
      }));
      expect(() => decodeBytecode(bytes, official)).toThrow(/requires a string constant, got number/);
    }
  });

  it("rejects a non-table constant in DUPTABLE", () => {
    const bytes = compile(proto({
      constants: strings("not a table"),
      instructions: [ad(Opcode.DUPTABLE, 0, 0), ret()],
    }));
    expect(() => decodeBytecode(bytes, official)).toThrow(/DUPTABLE requires a table constant, got string/);
  });

  it("accepts valid arithmetic and field references and still reconstructs Luau", () => {
    const bytes = compile(proto({
      constants: [{ kind: "number", value: 3 }, ...strings("Power")],
      instructions: [
        ad(Opcode.LOADN, 1, 4),
        abc(Opcode.ADDK, 0, 1, 0),
        abc(Opcode.GETGLOBAL, 2, 0, 0),
        1,
        abc(Opcode.RETURN, 0, 2, 0),
      ],
    }));
    const result = decompile(bytes, official);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.source).toContain("4 + 3");
    }
  });
});
