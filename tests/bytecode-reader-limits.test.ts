import { describe, expect, it } from "vitest";
import { BytecodeReader } from "../src/decode/BytecodeReader.ts";
import { decodeBytecode } from "../src/decode/Decoder.ts";
import { DEFAULT_SAFETY_LIMITS } from "../src/safety/Limits.ts";
import { compile, proto, ret } from "./helpers.ts";

function reader(...bytes: number[]): BytecodeReader {
  return new BytecodeReader(Uint8Array.from(bytes), DEFAULT_SAFETY_LIMITS);
}

describe("bytecode integer and upvalue limits", () => {
  it("accepts the maximum unsigned 32-bit varint", () => {
    expect(reader(0xff, 0xff, 0xff, 0xff, 0x0f).varint()).toBe(0xffffffff);
  });

  it("rejects overflowing 32-bit varints instead of wrapping", () => {
    expect(() => reader(0x80, 0x80, 0x80, 0x80, 0x10).varint()).toThrow(
      /unsigned 32-bit range/,
    );
    expect(() => reader(0xff, 0xff, 0xff, 0xff, 0x1f).varint()).toThrow(
      /unsigned 32-bit range/,
    );
  });

  it("accepts the maximum unsigned 64-bit varint", () => {
    expect(reader(...Array(9).fill(0xff), 0x01).varint64()).toBe((1n << 64n) - 1n);
  });

  it("rejects overflowing 64-bit varints instead of returning oversized values", () => {
    expect(() => reader(...Array(9).fill(0x80), 0x02).varint64()).toThrow(
      /unsigned 64-bit range/,
    );
    expect(() => reader(...Array(9).fill(0xff), 0x7f).varint64()).toThrow(
      /unsigned 64-bit range/,
    );
  });

  it("rejects an overflowing string count in an otherwise valid bytecode", () => {
    const valid = compile(proto({ instructions: [ret()] }));
    // The fixture has no strings: replace its one-byte zero count with a
    // five-byte encoding of 2^32, which used to wrap back to zero.
    expect(valid[2]).toBe(0);
    const invalid = new Uint8Array(valid.length + 4);
    invalid.set(valid.subarray(0, 2), 0);
    invalid.set([0x80, 0x80, 0x80, 0x80, 0x10], 2);
    invalid.set(valid.subarray(3), 7);
    expect(() => decodeBytecode(invalid)).toThrow(/unsigned 32-bit range/);
  });

  it("enforces the default and caller-defined upvalue limits", () => {
    const tooMany = compile(proto({ instructions: [ret()], numUpvalues: 201 }));
    expect(() => decodeBytecode(tooMany)).toThrow(/upvalue count 201 exceeds limit 200/);

    const oneUpvalue = compile(proto({ instructions: [ret()], numUpvalues: 1 }));
    expect(() => decodeBytecode(oneUpvalue, { limits: { maxUpvalues: 0 } })).toThrow(
      /upvalue count 1 exceeds limit 0/,
    );
  });
});
