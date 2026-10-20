import { describe, expect, it } from "vitest";
import { chunk, ident, lit, type Expression } from "../src/ast/Ast.ts";
import { hasArtificialComments, printLuau } from "../src/print/LuauPrinter.ts";

const neg = (argument: Expression): Expression => ({ kind: "unary", op: "-", argument });
const returned = (value: Expression) => printLuau(chunk([{ kind: "return", values: [value] }]));

describe("unary minus lexical correctness", () => {
  it("separates two unary minuses instead of printing a Luau comment", () => {
    const source = returned(neg(neg(ident("value"))));
    expect(source).toBe("return -(-value)\n");
    expect(hasArtificialComments(source)).toBe(false);
  });

  it("does not produce a comment for unary minus of a negative number", () => {
    const source = returned(neg(lit(-4)));
    expect(source).toBe("return -(-4)\n");
    expect(hasArtificialComments(source)).toBe(false);
  });

  it("preserves three successive negations with their original nesting", () => {
    const source = returned(neg(neg(neg(ident("value")))));
    expect(source).toBe("return -(-(-value))\n");
    expect(hasArtificialComments(source)).toBe(false);
  });

  it("does not change ordinary unary minus, subtraction or negative literals", () => {
    expect(returned(neg(ident("value")))).toBe("return -value\n");
    expect(returned(lit(-5))).toBe("return -5\n");
    expect(returned({ kind: "binary", op: "-", left: ident("a"), right: lit(-5) }))
      .toBe("return a - -5\n");
  });

  it("still parenthesizes the lower-precedence operand when negated", () => {
    const source = returned(neg({ kind: "binary", op: "+", left: ident("a"), right: ident("b") }));
    expect(source).toBe("return -(a + b)\n");
  });
});
