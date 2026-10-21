import { describe, expect, it } from "vitest";
import { abc, ad, Opcode, proto, ret, sourceOf, strings } from "./helpers.ts";

describe("call evaluation and value counts", () => {
  it("reads open arguments before replacing overlapping registers with call results", () => {
    const source = sourceOf(proto({
      constants: strings("pass", "many"),
      instructions: [
        abc(Opcode.GETGLOBAL, 0, 0, 0), 0,
        abc(Opcode.GETGLOBAL, 1, 0, 0), 1,
        abc(Opcode.CALL, 1, 1, 0),
        abc(Opcode.CALL, 0, 0, 4),
        abc(Opcode.RETURN, 0, 4, 0),
      ],
    }));
    expect(source).toContain("pass(many())");
    expect(source).not.toMatch(/\br\d+\b/);
  });

  it("expires an open pack when its register is reused for a fixed argument", () => {
    const source = sourceOf(proto({
      constants: strings("print", "many", "prefix"),
      instructions: [
        abc(Opcode.GETGLOBAL, 0, 0, 0), 0,
        abc(Opcode.GETGLOBAL, 1, 0, 0), 1,
        abc(Opcode.CALL, 1, 1, 0), abc(Opcode.CALL, 0, 0, 1),
        abc(Opcode.GETGLOBAL, 0, 0, 0), 0,
        ad(Opcode.LOADK, 1, 2),
        abc(Opcode.GETGLOBAL, 2, 0, 0), 1,
        abc(Opcode.CALL, 2, 1, 0), abc(Opcode.CALL, 0, 0, 1), ret(),
      ],
    }));
    expect(source).toContain('print("prefix", many())');
  });

  it("retains computed nil table keys through bytecode reconstruction", () => {
    const source = sourceOf(proto({
      constants: strings("key"),
      instructions: [
        abc(Opcode.NEWTABLE, 0, 0, 0), 0,
        abc(Opcode.GETGLOBAL, 1, 0, 0), 0,
        abc(Opcode.CALL, 1, 1, 2),
        abc(Opcode.LOADNIL, 2, 0, 0),
        abc(Opcode.SETTABLE, 2, 0, 1),
        abc(Opcode.RETURN, 0, 2, 0),
      ],
    }));
    expect(source).toContain("[key()] = nil");
  });

  it("does not turn a forwarded vararg pack into a single local value", () => {
    const source = sourceOf(proto({
      numParams: 1, isVararg: true,
      constants: strings("print", "select", "#"),
      instructions: [
        abc(Opcode.PREPVARARGS, 1, 0, 0),
        abc(Opcode.GETGLOBAL, 1, 0, 0), 0,
        abc(Opcode.GETGLOBAL, 2, 0, 0), 1,
        ad(Opcode.LOADK, 3, 2),
        abc(Opcode.GETVARARGS, 4, 0, 0),
        abc(Opcode.CALL, 2, 0, 2),
        abc(Opcode.GETVARARGS, 3, 0, 0),
        abc(Opcode.CALL, 1, 0, 1), ret(),
      ],
    }));
    expect(source).toContain('print(select("#", ...), ...)');
    expect(source).not.toMatch(/local \w+ = \.\.\./);
  });

  it("evaluates a single-use call before an intervening statement", () => {
    const source = sourceOf(proto({
      constants: strings("compute", "print", "middle"),
      instructions: [
        abc(Opcode.GETGLOBAL, 0, 0, 0), 0,
        abc(Opcode.CALL, 0, 1, 2),
        abc(Opcode.GETGLOBAL, 1, 0, 0), 1,
        ad(Opcode.LOADK, 2, 2),
        abc(Opcode.CALL, 1, 2, 1),
        abc(Opcode.GETGLOBAL, 1, 0, 0), 1,
        abc(Opcode.MOVE, 2, 0, 0),
        abc(Opcode.CALL, 1, 2, 1), ret(),
      ],
    }));
    expect(source).toContain("compute()");
    expect(source).toContain('print("middle")');
    expect(source.indexOf("compute()")).toBeLessThan(source.indexOf('print("middle")'));
  });

  it("keeps a fixed one-result return from expanding its call", () => {
    const source = sourceOf(proto({
      constants: strings("many"),
      instructions: [abc(Opcode.GETGLOBAL, 0, 0, 0), 0, abc(Opcode.CALL, 0, 1, 2), abc(Opcode.RETURN, 0, 2, 0)],
    }));
    expect(source).toBe("return (many())\n");
  });

  it("omits the implicit receiver from an open method argument list", () => {
    const source = sourceOf(proto({
      numParams: 1,
      constants: strings("method", "many"),
      instructions: [
        abc(Opcode.NAMECALL, 1, 0, 0), 0,
        abc(Opcode.GETGLOBAL, 3, 0, 0), 1,
        abc(Opcode.CALL, 3, 1, 0),
        abc(Opcode.CALL, 1, 0, 1), ret(),
      ],
    }));
    expect(source).toBe("value:method(many())\n");
  });

  it("preserves the right association of a multi-operand CONCAT", () => {
    const source = sourceOf(proto({
      numParams: 3,
      instructions: [abc(Opcode.CONCAT, 3, 0, 2), abc(Opcode.RETURN, 3, 2, 0)],
    }));
    expect(source).toBe("return value .. index .. count\n");
  });
});
