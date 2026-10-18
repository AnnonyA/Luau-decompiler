import { describe, expect, it } from "vitest";
import { decodeBytecode } from "../src/decode/Decoder.ts";
import { decompile } from "../src/decompile.ts";
import { abc, ad, compile, importConst, Opcode, proto, strings } from "./helpers.ts";

const official = { opcodeEncoding: "official" as const };

/** Modify only the encoded IMPORT constant, not GETIMPORT's AUX instruction. */
function withImportId(importId: number): Uint8Array {
  const bytes = compile(proto({
    constants: [...strings("game"), importConst(["game"])],
    instructions: [
      ad(Opcode.GETIMPORT, 0, 1),
      0x40000000,
      abc(Opcode.RETURN, 0, 2, 0),
    ],
  }));
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const locations: number[] = [];
  for (let i = 0; i <= bytes.length - 4; i++) {
    if (view.getUint32(i, true) === 0x40000000) {
      locations.push(i);
    }
  }
  // The first occurrence is the GETIMPORT AUX field; the last is its
  // import constant. The bytecode framing stays otherwise unchanged.
  expect(locations.length).toBeGreaterThanOrEqual(2);
  view.setUint32(locations.at(-1)!, importId, true);
  return bytes;
}

describe("strict Luau import path validation", () => {
  it("rejects an import pointing beyond the preceding constant pool", () => {
    const bytes = withImportId(0x40200000);
    expect(() => decodeBytecode(bytes, official)).toThrow(/import component 0 references missing or non-string constant 2/);
    const result = decompile(bytes, official);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("import-ref");
    }
  });

  it("rejects an import pointing to a non-string constant", () => {
    const bytes = withImportId(0x40100000);
    expect(() => decodeBytecode(bytes, official)).toThrow(/import component 0 references missing or non-string constant 1/);
  });

  it("rejects a zero-length import path rather than manufacturing an identifier", () => {
    const bytes = withImportId(0);
    expect(() => decodeBytecode(bytes, official)).toThrow(/import constant has no path components/);
  });

  it("decodes legitimate one-, two- and three-component imports", () => {
    for (const path of [["game"], ["game", "Players"], ["game", "Players", "LocalPlayer"]]) {
      const bytes = compile(proto({
        constants: [...strings("game", "Players", "LocalPlayer"), importConst(path)],
        instructions: [
          ad(Opcode.GETIMPORT, 0, 3),
          0x40000000,
          abc(Opcode.RETURN, 0, 2, 0),
        ],
      }));
      const { module } = decodeBytecode(bytes, official);
      expect(module.prototypes[module.mainProtoId]!.constants[3]).toMatchObject({ kind: "import", path });
      const result = decompile(bytes, official);
      expect(result.ok).toBe(true);
    }
  });

  it("preserves correct import references after unrelated constants", () => {
    const bytes = compile(proto({
      constants: [{ kind: "number", value: 12 }, ...strings("print"), importConst(["print"])],
      instructions: [
        ad(Opcode.GETIMPORT, 0, 2),
        0x40000000,
        abc(Opcode.CALL, 0, 1, 1),
        abc(Opcode.RETURN, 0, 1, 0),
      ],
    }));
    const result = decompile(bytes, official);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.source).toContain("print()");
    }
  });
});
