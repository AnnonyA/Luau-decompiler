import { describe, expect, it } from "vitest";
import { decodeBytecode } from "../src/decode/Decoder.ts";
import { decompile } from "../src/decompile.ts";
import { abc, ad, compile, Opcode, proto, ret, strings } from "./helpers.ts";

const official = { opcodeEncoding: "official" as const };

function tableBytecode(constants: Parameters<typeof proto>[0]["constants"], templateIndex: number): Uint8Array {
  return compile(proto({
    constants,
    instructions: [ad(Opcode.DUPTABLE, 0, templateIndex), abc(Opcode.RETURN, 0, 2, 0)],
  }));
}

describe("table template key references", () => {
  it.each([
    ["table", [{ kind: "table" as const, keys: [9] }]],
    ["tableWithConstants", [{ kind: "tableWithConstants" as const, entries: [{ key: 9, value: 0 }] }]],
  ])("rejects a missing %s template key without dropping its field", (_kind, constants) => {
    const bytes = tableBytecode(constants, 0);
    expect(() => decodeBytecode(bytes, official)).toThrow(/table constant 0 references missing key constant 9/);
    const result = decompile(bytes, official);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("constant-ref");
    }
  });

  it.each([
    ["table", [{ kind: "number" as const, value: 3 }, { kind: "table" as const, keys: [0] }]],
    ["tableWithConstants", [{ kind: "number" as const, value: 3 }, { kind: "tableWithConstants" as const, entries: [{ key: 0, value: 0 }] }]],
  ])("rejects a non-string %s template key", (_kind, constants) => {
    const bytes = tableBytecode(constants, 1);
    expect(() => decodeBytecode(bytes, official)).toThrow(/table constant 1 requires a string key at constant 0/);
    const result = decompile(bytes, official);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("constant-kind");
    }
  });

  it("accepts valid DUPTABLE templates and preserves field assignment", () => {
    const bytes = compile(proto({
      constants: [...strings("ready"), { kind: "table", keys: [0] }],
      instructions: [
        ad(Opcode.DUPTABLE, 0, 1),
        abc(Opcode.LOADB, 1, 1, 0),
        abc(Opcode.SETTABLEKS, 1, 0, 0),
        0,
        abc(Opcode.RETURN, 0, 2, 0),
      ],
    }));
    const result = decompile(bytes, official);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.validation).toEqual([]);
      expect(result.source).toContain("ready = true");
    }
  });

  it("accepts string-key table templates with constants", () => {
    const bytes = tableBytecode(
      [...strings("name", "value"), { kind: "tableWithConstants", entries: [{ key: 0, value: 1 }] }],
      2,
    );
    const decoded = decodeBytecode(bytes, official);
    expect(decoded.module.prototypes[decoded.module.mainProtoId]!.constants[2]).toMatchObject({
      kind: "tableWithConstants",
      entries: [{ key: 0, value: 1 }],
    });
  });
});
