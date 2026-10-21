import { describe, expect, it } from "vitest";
import { abc, ad, Opcode, proto, ret, sourceOf, strings } from "./helpers.ts";

describe("fixed call arguments before an open multret argument", () => {
  it("does not truncate print(f(), g(), h()) at the first one-result call", () => {
    const source = sourceOf(proto({
      constants: strings("print", "compute", "calls"),
      instructions: [
        abc(Opcode.GETGLOBAL, 0, 0, 0), 0,
        ad(Opcode.LOADK, 1, 2),
        abc(Opcode.GETGLOBAL, 2, 0, 0), 1,
        ad(Opcode.LOADN, 3, -3),
        abc(Opcode.CALL, 2, 2, 2),
        abc(Opcode.GETGLOBAL, 3, 0, 0), 1,
        ad(Opcode.LOADN, 4, 0),
        abc(Opcode.CALL, 3, 2, 2),
        abc(Opcode.GETGLOBAL, 4, 0, 0), 1,
        ad(Opcode.LOADN, 5, 7),
        abc(Opcode.CALL, 4, 2, 0),
        abc(Opcode.CALL, 0, 0, 1),
        ret(),
      ],
    }));
    expect(source).toMatch(/print\("calls", compute\(-3\), compute\(0\), compute\((?:7|value)\)\)/);
    if (source.includes("compute(value)")) {
      expect(source).toMatch(/local value(?:: number)? = 7/);
    }
    expect(source.match(/compute\(/g)).toHaveLength(3);
    expect(source).not.toMatch(/local _\d* = compute\(/);
  });

  it("retains a fixed value before the open trailing call", () => {
    const source = sourceOf(proto({
      constants: strings("print", "get", "event"),
      instructions: [
        abc(Opcode.GETGLOBAL, 0, 0, 0), 0,
        ad(Opcode.LOADK, 1, 2),
        ad(Opcode.LOADN, 2, 19),
        abc(Opcode.GETGLOBAL, 3, 0, 0), 1,
        abc(Opcode.CALL, 3, 1, 0),
        abc(Opcode.CALL, 0, 0, 1),
        ret(),
      ],
    }));
    expect(source).toContain('print("event", 19, get())');
  });

  it("does not change a fixed-argument call that ends with a single-result callee", () => {
    const source = sourceOf(proto({
      constants: strings("print", "get"),
      instructions: [
        abc(Opcode.GETGLOBAL, 0, 0, 0), 0,
        abc(Opcode.GETGLOBAL, 1, 0, 0), 1,
        abc(Opcode.CALL, 1, 1, 2),
        abc(Opcode.CALL, 0, 2, 1),
        ret(),
      ],
    }));
    expect(source).toContain("print((get()))");
    expect(source.match(/get\(/g)).toHaveLength(1);
  });
});
