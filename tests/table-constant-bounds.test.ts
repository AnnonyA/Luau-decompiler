import { describe, expect, it } from "vitest";
import { decodeBytecode } from "../src/decode/Decoder.ts";
import { BytecodeError } from "../src/decode/BytecodeError.ts";
import { writeBytecode } from "../src/decode/BytecodeWriter.ts";
import { proto, ret, strings } from "./helpers.ts";

describe("bounded bytecode constant templates", () => {
  it("rejects oversized table key lists before consuming any entries", () => {
    const bytes = writeBytecode(proto({
      constants: [{ kind: "table", keys: [0, 0] }],
      instructions: [ret()],
    }));
    expect(() => decodeBytecode(bytes, {
      opcodeEncoding: "official", limits: { maxConstantsPerPrototype: 1 },
    })).toThrow(/table key count 2 exceeds limit 1/);
  });

  it("rejects oversized table-with-constants entry lists", () => {
    const bytes = writeBytecode(proto({
      constants: [{ kind: "tableWithConstants", entries: [{ key: 0, value: 1 }, { key: 0, value: 2 }] }],
      instructions: [ret()],
    }));
    expect(() => decodeBytecode(bytes, {
      opcodeEncoding: "official", limits: { maxConstantsPerPrototype: 1 },
    })).toThrow(/table entry count 2 exceeds limit 1/);
  });

  it("still decodes a valid table template at the configured bound", () => {
    const bytes = writeBytecode(proto({
      constants: [...strings("item"), { kind: "table", keys: [0] }],
      instructions: [ret()],
    }));
    const result = decodeBytecode(bytes, {
      opcodeEncoding: "official", limits: { maxConstantsPerPrototype: 2 },
    });
    expect(result.module.prototypes[0]?.constants[1]).toMatchObject({ kind: "table", keys: [0] });
  });

  it("returns a structured limit error instead of processing a large declared key list", () => {
    const bytes = writeBytecode(proto({
      constants: [{ kind: "table", keys: [0, 0] }], instructions: [ret()],
    }));
    try {
      decodeBytecode(bytes, { opcodeEncoding: "official", limits: { maxConstantsPerPrototype: 1 } });
      throw new Error("expected bytecode limit failure");
    } catch (error) {
      expect(error).toBeInstanceOf(BytecodeError);
      expect((error as BytecodeError).code).toBe("limit");
    }
  });
});
