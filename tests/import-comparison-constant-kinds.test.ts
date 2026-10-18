import { describe, expect, it } from "vitest";
import { decodeBytecode } from "../src/decode/Decoder.ts";
import { decompile } from "../src/decompile.ts";
import { abc, ad, compile, importConst, Opcode, proto, ret, strings } from "./helpers.ts";

const official = { opcodeEncoding: "official" as const };

describe("GETIMPORT and constant-comparison operand types", () => {
  it.each([
    ["string", strings("game")],
    ["number", [{ kind: "number" as const, value: 5 }]],
  ])("rejects a %s constant used as an import", (kind, constants) => {
    const bytes = compile(proto({
      constants,
      instructions: [ad(Opcode.GETIMPORT, 0, 0), 0x40000000, ret()],
    }));
    expect(() => decodeBytecode(bytes, official)).toThrow(
      new RegExp(`GETIMPORT requires an import constant, got ${kind}`),
    );
    const result = decompile(bytes, official);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("constant-kind");
    }
  });

  it.each([
    ["string", strings("5")],
    ["boolean", [{ kind: "boolean" as const, value: true }]],
  ])("rejects a %s constant used by JUMPXEQKN", (kind, constants) => {
    const bytes = compile(proto({
      constants,
      instructions: [ad(Opcode.JUMPXEQKN, 0, 1), 0, ret(), ret()],
    }));
    expect(() => decodeBytecode(bytes, official)).toThrow(
      new RegExp(`JUMPXEQKN requires a number constant, got ${kind}`),
    );
  });

  it("keeps real GETIMPORT constants valid and reconstructs the call", () => {
    const bytes = compile(proto({
      constants: [...strings("print"), importConst(["print"])],
      instructions: [
        ad(Opcode.GETIMPORT, 0, 1),
        0x40000000,
        abc(Opcode.CALL, 0, 1, 1),
        ret(),
      ],
    }));
    const result = decompile(bytes, official);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.source).toContain("print()");
    }
  });

  it("accepts numeric constants used by JUMPXEQKN", () => {
    const bytes = compile(proto({
      numParams: 1,
      constants: [{ kind: "number", value: 9.25 }],
      instructions: [ad(Opcode.JUMPXEQKN, 0, 1), 0, ret(), ret()],
    }));
    const decoded = decodeBytecode(bytes, official);
    expect(decoded.module.prototypes[decoded.module.mainProtoId]!.instructions[0]!.constantIndex).toBe(0);
  });
});
