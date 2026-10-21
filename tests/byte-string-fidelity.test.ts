import { describe, expect, it } from "vitest";
import { BytecodeReader } from "../src/decode/BytecodeReader.ts";
import { decodeByteString, encodeByteString } from "../src/decode/BytecodeString.ts";
import { DEFAULT_SAFETY_LIMITS } from "../src/safety/Limits.ts";
import { quoteLuauString } from "../src/decode/Constant.ts";
import { chunk, lit } from "../src/ast/Ast.ts";
import { printLuau } from "../src/print/LuauPrinter.ts";
import { abc, ad, compile, decode, Opcode, proto, strings } from "./helpers.ts";

describe("byte-preserving Luau strings", () => {
  it("round-trips every byte alongside valid Unicode and an embedded BOM", () => {
    const bytes = new Uint8Array([
      ...new TextEncoder().encode("é🙂\u{10080}"),
      ...Array.from({ length: 256 }, (_, i) => i),
      ...new TextEncoder().encode("\ufeff日本語"),
    ]);
    expect(encodeByteString(decodeByteString(bytes))).toEqual(bytes);
  });

  it.each([
    [0xe0, 0x80, 0x80], // overlong encoding
    [0xed, 0xa0, 0x80], // surrogate code point
    [0xf4, 0x90, 0x80, 0x80], // outside Unicode
    [0xf0, 0x9f], // truncated sequence
  ])("retains malformed UTF-8 sequence %j", (...sequence) => {
    const bytes = new Uint8Array(sequence);
    const decoded = decodeByteString(bytes);
    expect(decoded).not.toContain("\ufffd");
    expect(encodeByteString(decoded)).toEqual(bytes);
  });

  it("retains an initial UTF-8 BOM as string data", () => {
    const bytes = new Uint8Array([239, 187, 191, 120]);
    expect(new BytecodeReader(bytes, DEFAULT_SAFETY_LIMITS).utf8(bytes.length)).toBe("\ufeffx");
  });

  it("represents invalid UTF-8 bytes with distinct surrogate escapes", () => {
    const bytes = new Uint8Array([255, 128, 0, 65, 192, 175]);
    expect(new BytecodeReader(bytes, DEFAULT_SAFETY_LIMITS).utf8(bytes.length)).toBe("\udcff\udc80\0A\udcc0\udcaf");
  });

  it("prints raw bytes without corrupting valid supplementary Unicode", () => {
    const value = "\udcff\udc80\0" + "12\u{10080}🙂";
    const expected = '"\\255\\128\\00012\u{10080}🙂"';
    expect(quoteLuauString(value)).toBe(expected);
    expect(printLuau(chunk([{ kind: "return", values: [lit(value)] }]))).toBe(`return ${expected}\n`);
    expect(printLuau(chunk([{ kind: "return", values: [{ kind: "interp", parts: [{ kind: "text", value }] }] }])))
      .toBe('return `\\255\\128\\00012\u{10080}🙂`\n');
  });

  it("writes byte escapes as original bytes and preserves them on decoding", () => {
    const value = "\udcff\udc80\0A";
    const main = proto({ constants: strings(value), instructions: [ad(Opcode.LOADK, 0, 0), abc(Opcode.RETURN, 0, 2, 0)] });
    const bytes = compile(main);
    expect(Buffer.from(bytes).includes(Buffer.from([255, 128, 0, 65]))).toBe(true);
    expect(decode(main).module.prototypes[0]!.constants[0]).toMatchObject({ kind: "string", value });
  });
});
