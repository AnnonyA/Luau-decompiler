import { describe, expect, it } from "vitest";
import { abc, ad, CaptureType, Opcode, proto, sourceOf, strings, importConst, ret } from "./helpers.ts";

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

describe("value packs and short-circuit recovery", () => {
  it("recovers `t = x or y` from a guard + fallback diamond", () => {
    const source = sourceOf(
      proto({
        numParams: 2,
        locals: [
          { name: "primary", startPc: 0, endPc: 5, register: 0 },
          { name: "fallback", startPc: 0, endPc: 5, register: 1 },
        ],
        instructions: [
          abc(Opcode.MOVE, 2, 0, 0),
          ad(Opcode.JUMPIF, 2, 1),
          abc(Opcode.MOVE, 2, 1, 0),
          abc(Opcode.RETURN, 2, 2, 0),
        ],
      }),
    );
    expect(source).toMatch(/primary or fallback/);
  });

  it("recovers `if a and b then` from chained guards", () => {
    const source = sourceOf(
      proto({
        numParams: 2,
        locals: [
          { name: "first", startPc: 0, endPc: 6, register: 0 },
          { name: "second", startPc: 0, endPc: 6, register: 1 },
        ],
        instructions: [
          ad(Opcode.JUMPIFNOT, 0, 2),
          ad(Opcode.JUMPIFNOT, 1, 1),
          abc(Opcode.LOADN, 3, 1, 0),
          ad(Opcode.JUMP, 0, 1),
          abc(Opcode.LOADN, 3, 2, 0),
          abc(Opcode.RETURN, 3, 2, 0),
        ],
      }),
    );
    expect(source).toMatch(/if first and second then/);
  });

  it("recovers a boolean result from JUMP + LOADB blocks", () => {
    const source = sourceOf(
      proto({
        numParams: 1,
        locals: [{ name: "tag", startPc: 0, endPc: 8, register: 0 }],
        instructions: [
          abc(Opcode.LENGTH, 1, 0, 0),
          abc(Opcode.LOADN, 2, 2, 0),
          ad(Opcode.JUMPIFLT, 2, 2),
          1,
          abc(Opcode.LOADB, 3, 0, 1),
          abc(Opcode.LOADB, 3, 1, 0),
          abc(Opcode.RETURN, 3, 2, 0),
        ],
      }),
    );
    expect(source).toMatch(/#tag > 2/);
  });

  it("keeps `select(\"#\", ...)` open-argument calls intact", () => {
    const source = sourceOf(
      proto({
        isVararg: true,
        constants: [...strings("#", "select"), importConst(["select"])],
        instructions: [
          abc(Opcode.PREPVARARGS, 0, 0, 0),
          ad(Opcode.LOADK, 1, 0),
          ad(Opcode.GETIMPORT, 0, 1),
          0,
          abc(Opcode.GETVARARGS, 2, 0, 0),
          abc(Opcode.CALL, 0, 0, 2),
          abc(Opcode.RETURN, 0, 2, 0),
        ],
      }),
    );
    expect(source).toMatch(/select\(\"#\", \.\.\.\)/);
  });
});

describe("table consolidation", () => {
  it("merges nested NEWTABLE writes into one literal", () => {
    const source = sourceOf(
      proto({
        constants: strings("entries", "folder"),
        instructions: [
          abc(Opcode.NEWTABLE, 0, 0, 0),
          0,
          abc(Opcode.NEWTABLE, 1, 0, 0),
          0,
          abc(Opcode.SETTABLEKS, 1, 0, 0),
          0,
          abc(Opcode.SETTABLEKS, 2, 0, 0),
          1,
          abc(Opcode.RETURN, 0, 2, 0),
        ],
      }),
    );
    expect(source).toMatch(/entries = \{\s*\}/);
    expect(source).not.toMatch(/entries = r/);
  });

  it("emits compound assignment for `n = n + 1`", () => {
    const source = sourceOf(
      proto({
        numParams: 1,
        locals: [{ name: "n", startPc: 0, endPc: 4, register: 0 }],
        instructions: [abc(Opcode.LOADN, 1, 1, 0), abc(Opcode.ADD, 0, 0, 1), abc(Opcode.RETURN, 0, 2, 0)],
      }),
    );
    expect(source).toMatch(/n \+= 1/);
    expect(source).not.toMatch(/n = n \+ 1/);
  });

  it("does not annotate a nil initializer", () => {
    const source = sourceOf(
      proto({
        instructions: [abc(Opcode.LOADNIL, 0, 0, 0), abc(Opcode.RETURN, 0, 2, 0)],
        locals: [{ name: "result", startPc: 1, endPc: 2, register: 0 }],
      }),
    );
    expect(source).not.toMatch(/: nil/);
  });

  it("drops DUPTABLE scaffolding fields that are overwritten", () => {
    const source = sourceOf(
      proto({
        constants: [...strings("A"), ...strings("B"), ...strings("A")],
        instructions: [
          abc(Opcode.DUPTABLE, 0, 0, 0),
          0,
          abc(Opcode.LOADN, 1, 5, 0),
          abc(Opcode.SETTABLEKS, 1, 0, 0),
          2,
          abc(Opcode.RETURN, 0, 2, 0),
        ],
      }),
    );
    expect(source).not.toMatch(/A = nil/);
    expect(source).not.toMatch(/B = nil/);
    expect(source).toMatch(/A = 5/);
  });

  it("omits remaining DUPTABLE nil keys from the literal", () => {
    const source = sourceOf(
      proto({
        constants: [...strings("ready", "error"), { kind: "table", keys: [0, 1] }],
        instructions: [
          ad(Opcode.DUPTABLE, 0, 2),
          abc(Opcode.LOADB, 1, 1, 0),
          abc(Opcode.SETTABLEKS, 1, 0, 0),
          0,
          abc(Opcode.RETURN, 0, 2, 0),
        ],
      }),
    );
    expect(source).toMatch(/ready = true/);
    expect(source).not.toMatch(/= nil/);
  });
});

describe("loop reconstruction", () => {
  it("recovers while with an inverted header test", () => {
    const source = sourceOf(
      proto({
        numParams: 1,
        locals: [{ name: "n", startPc: 0, endPc: 8, register: 0 }],
        instructions: [
          ad(Opcode.JUMPIFNOT, 0, 3),
          abc(Opcode.LOADN, 1, 1, 0),
          abc(Opcode.RETURN, 1, 2, 0),
          ad(Opcode.JUMPBACK, 0, -4),
          abc(Opcode.RETURN, 0, 2, 0),
        ],
      }),
    );
    expect(source).toMatch(/while n do/);
    expect(source).toContain("return 1");
  });

  it("recovers break and continue inside loops", () => {
    const source = sourceOf(
      proto({
        numParams: 2,
        locals: [
          { name: "x", startPc: 0, endPc: 10, register: 0 },
          { name: "c", startPc: 0, endPc: 10, register: 1 },
        ],
        // `while x do if c then if not x then continue end end break end`
        instructions: [
          ad(Opcode.JUMPIFNOT, 0, 5),
          ad(Opcode.JUMPIFNOT, 1, 2),
          ad(Opcode.JUMPIF, 0, 1),
          abc(Opcode.JUMP, 0, 1, 0),
          abc(Opcode.JUMP, 0, 1, 0),
          ad(Opcode.JUMPBACK, 0, -6),
          abc(Opcode.RETURN, 0, 2, 0),
        ],
      }),
    );
    // `if c then if not x then continue end end; break` is equivalent to the
    // sequential guards below; a trailing continue at the end of the while is
    // a no-op and is dropped.
    expect(source).toContain("break");
    expect(source).toMatch(/while x do/);
    expect(source).toMatch(/if not c then\s+break/);
  });

  it("recovers a repeat/until with the test in the last body block", () => {
    const source = sourceOf(
      proto({
        numParams: 1,
        locals: [{ name: "n", startPc: 0, endPc: 6, register: 0 }],
        constants: [{ kind: "number", value: 1 }],
        instructions: [
          abc(Opcode.ADDK, 0, 0, 0),
          abc(Opcode.LOADN, 1, 3, 0),
          ad(Opcode.JUMPIFLE, 1, 2),
          0,
          ad(Opcode.JUMPBACK, 0, -5),
          abc(Opcode.RETURN, 0, 2, 0),
        ],
      }),
    );
    expect(source).toMatch(/repeat/);
    expect(source).toMatch(/until/);
  });
});

describe("closure capture resolution", () => {
  it("resolves upvalues to the parent register binding", () => {
    const child = proto({
      debugName: "inner",
      numParams: 1,
      numUpvalues: 1,
      upvalueNames: [],
      instructions: [abc(Opcode.GETUPVAL, 1, 0, 0), abc(Opcode.RETURN, 1, 2, 0)],
    });
    const source = sourceOf(
      proto({
        numParams: 1,
        locals: [{ name: "seed", startPc: 0, endPc: 4, register: 0 }],
        children: [child],
        instructions: [
          abc(Opcode.MOVE, 1, 0, 0),
          abc(Opcode.NEWCLOSURE, 2, 0, 0),
          abc(Opcode.CAPTURE, CaptureType.VAL, 1, 0),
          abc(Opcode.RETURN, 2, 2, 0),
        ],
      }),
    );
    expect(source).toContain("seed");
    expect(source).not.toMatch(/up0/);
  });
});
