import { describe, expect, it } from "vitest";
import { decompile } from "../src/decompile.ts";
import { abc, ad, compile, Opcode, proto, ret, strings } from "./helpers.ts";

/**
 * Public Apache-2.0 LunaUX BinaryOperationSimple bytecode fixture, pinned at
 * boydev-1444/lunaux-decompiler@910ccd4d546fd0c8e21f770a30732ae246eab5c5.
 * Git blob: fdc98e6d37f9beb5a121b8eb326c8305346277d1.
 * Expected side-effectful expressions originate from two unused MUL results.
 * No competitor implementation is used.
 */
const binaryOperationSimple = Buffer.from(
  "0b030401780179017a0177000106000001020015410000000c010100000000400c030300000020400c0405000000404021020304230001020c030100000000400c04070000006040220203040c040300000020400c050500000040402103040523010203160001000803010400000040030204000020400303040000404003040400006040000100011800000000000000000000000000000000000000000001000000000000",
  "hex",
);

describe("discarded expression evaluation must not disappear", () => {
  it("preserves two discarded arithmetic operations from the pinned LunaUX sample", () => {
    const result = decompile(binaryOperationSimple);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.validation).toEqual([]);
    expect(result.source.match(/\*/g)).toHaveLength(2);
    expect(result.source).toContain("x");
    expect(result.source).toContain("y");
    expect(result.source.trim().length).toBeGreaterThan(10);
  });

  it("keeps an unused arithmetic result because operands may have metamethods", () => {
    const bytes = compile(proto({
      instructions: [
        abc(Opcode.ADD, 0, 1, 2),
        ret(),
      ],
      numParams: 3,
    }));
    const result = decompile(bytes, { opcodeEncoding: "official" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.source).toMatch(/local \w+ = index \+ count/);
  });

  it("keeps an unused unary length that may invoke __len", () => {
    const bytes = compile(proto({
      instructions: [
        abc(Opcode.LENGTH, 0, 1, 0),
        ret(),
      ],
      numParams: 2,
    }));
    const result = decompile(bytes, { opcodeEncoding: "official" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.source).toMatch(/local \w+ = #index/);
  });

  it("does not emit a pointless local for an unused literal", () => {
    const bytes = compile(proto({ instructions: [ad(Opcode.LOADN, 0, 42), ret()] }));
    const result = decompile(bytes, { opcodeEncoding: "official" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.source).not.toContain("local _ = 42");
  });

  it("keeps unused global reads that can invoke an environment __index", () => {
    const bytes = compile(proto({
      constants: strings("tracked"),
      instructions: [abc(Opcode.GETGLOBAL, 0, 0, 0), 0, ret()],
    }));
    const result = decompile(bytes, { opcodeEncoding: "official" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.source).toContain("local _ = tracked");
  });
});
