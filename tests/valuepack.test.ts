import { describe, expect, it } from "vitest";
import { abc, ad, Opcode, proto, sourceOf, strings, importConst, ret } from "./helpers.ts";

describe("value packs", () => {
  it("keeps a fixed multi-result call intact", () => {
    const source = sourceOf(
      proto({
        constants: [...strings("pair"), importConst(["pair"])],
        instructions: [
          ad(Opcode.GETIMPORT, 0, 1),
          0x40000000,
          abc(Opcode.CALL, 0, 1, 3),
          abc(Opcode.RETURN, 0, 3, 0),
        ],
        locals: [
          { name: "left", startPc: 3, endPc: 5, register: 0 },
          { name: "right", startPc: 3, endPc: 5, register: 1 },
        ],
      }),
    );
    expect(source).toMatch(/local left, right = pair\(\)/);
  });

  it("forwards an open pack into return", () => {
    const source = sourceOf(
      proto({
        isVararg: true,
        instructions: [abc(Opcode.PREPVARARGS, 0, 0, 0), abc(Opcode.GETVARARGS, 0, 0, 0), abc(Opcode.RETURN, 0, 0, 0)],
      }),
    );
    expect(source).toMatch(/return \.\.\./);
    expect(source).not.toContain("--");
  });

  it("does not invent comments when reconstructing AND/OR", () => {
    const source = sourceOf(
      proto({
        numParams: 2,
        locals: [
          { name: "left", startPc: 0, endPc: 3, register: 0 },
          { name: "right", startPc: 0, endPc: 3, register: 1 },
        ],
        instructions: [abc(Opcode.AND, 2, 0, 1), abc(Opcode.RETURN, 2, 2, 0)],
      }),
    );
    expect(source).toContain("left and right");
  });
});
