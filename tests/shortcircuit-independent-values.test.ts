import { describe, expect, it } from "vitest";
import { sourceOf, abc, ad, Opcode, proto } from "./helpers.ts";

describe("sequential short-circuit register values", () => {
  it("keeps four independent boolean/value joins in separate registers", () => {
    // Mimics official Luau's register layout for
    // local a = lhsA and rhsA; local b = lhsB or rhsB; ...
    // The joins occupy R2..R5; they must not all alias one result local.
    const source = sourceOf(proto({
      maxStackSize: 8,
      instructions: [
        abc(Opcode.LOADB, 2, 0, 0),
        ad(Opcode.JUMPIFNOT, 2, 1), // skip alternate assignment
        abc(Opcode.LOADB, 2, 1, 0),
        abc(Opcode.LOADB, 3, 1, 0),
        ad(Opcode.JUMPIF, 3, 1),
        abc(Opcode.LOADB, 3, 0, 0),
        abc(Opcode.LOADB, 4, 1, 0),
        ad(Opcode.JUMPIFNOT, 4, 1),
        ad(Opcode.LOADN, 4, 17),
        abc(Opcode.LOADB, 5, 0, 0),
        ad(Opcode.JUMPIF, 5, 1),
        ad(Opcode.LOADN, 5, 23),
        abc(Opcode.RETURN, 2, 5, 0),
      ],
    }));
    const returnLine = source.split("\n").find((line) => line.startsWith("return "));
    expect(returnLine).toBeDefined();
    const names = returnLine!.slice("return ".length).split(", ").map((s) => s.trim());
    expect(names).toHaveLength(4);
    expect(new Set(names).size).toBe(4);
  });
});
