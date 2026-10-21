import { describe, expect, it } from "vitest";
import { abc, ad, Opcode, proto, sourceOf } from "./helpers.ts";

describe("negative constant bases in reconstructed powers", () => {
  it.each([
    [Opcode.POW, -2, "(-2) ^ exponent"],
    [Opcode.POW, -0, "(-0) ^ exponent"],
    [Opcode.POWK, -2, "(-2) ^ 2"],
    [Opcode.POWK, -0, "(-0) ^ 2"],
  ] as const)("preserves the base for opcode %i and constant %s", (opcode, base, expression) => {
    const source = sourceOf(proto({
      maxStackSize: 3,
      numParams: 1,
      constants: [{ kind: "number", value: base }, { kind: "number", value: 2 }],
      locals: [{ name: "exponent", register: 0, startPc: 0, endPc: 3 }],
      instructions: [
        ad(Opcode.LOADK, 1, 0),
        abc(opcode, 2, 1, opcode === Opcode.POW ? 0 : 1),
        abc(Opcode.RETURN, 2, 2, 0),
      ],
    }));

    expect(source).toBe(`return ${expression}\n`);
  });
});
