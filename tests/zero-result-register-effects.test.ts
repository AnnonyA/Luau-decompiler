import { describe, expect, it } from "vitest";
import { decodeInstructionWord } from "../src/decode/DecodedInstruction.js";
import { Opcode } from "../src/decode/Opcode.js";

const abc = (op: Opcode, a: number, b: number, c: number) =>
  (op | (a << 8) | (b << 16) | (c << 24)) >>> 0;

describe("zero-result register definitions", () => {
  it.each([Opcode.CALL, Opcode.CALLFB])("does not define registers for zero-result call %s", (op) => {
    const words = new Uint32Array(op === Opcode.CALLFB ? [abc(op, 3, 1, 1), 0] : [abc(op, 3, 1, 1)]);
    const instruction = decodeInstructionWord(words, 0, 1);
    expect(instruction.call?.resultCount).toBe(0);
    expect(instruction.uses).toEqual([3]);
    expect(instruction.defs).toEqual([]);
  });

  it.each([[0, [3]], [1, []], [2, [3]], [4, [3, 4, 5]]])("CALL C=%i defines %j", (c, defs) => {
    expect(decodeInstructionWord(new Uint32Array([abc(Opcode.CALL, 3, 1, c as number)]), 0, 0).defs).toEqual(defs);
  });

  it.each([[0, [3]], [1, []], [2, [3]], [4, [3, 4, 5]]])("GETVARARGS B=%i defines %j", (b, defs) => {
    expect(decodeInstructionWord(new Uint32Array([abc(Opcode.GETVARARGS, 3, b as number, 0)]), 0, 0).defs).toEqual(defs);
  });
});
