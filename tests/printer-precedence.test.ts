import { describe, expect, it } from "vitest";
import { chunk, ident, lit, type Expression } from "../src/ast/Ast.ts";
import { printLuau } from "../src/print/LuauPrinter.ts";

const conditional: Expression = {
  kind: "if-expr",
  test: ident("flag"),
  consequent: ident("left"),
  branches: [],
  alternate: ident("right"),
};

function returnSource(value: Expression): string {
  return printLuau(chunk([{ kind: "return", values: [value] }]));
}

describe("reconstructed Luau expression precedence", () => {
  it.each([
    [-2, "-2"],
    [-0, "-0"],
    [-0.25, "-0.25"],
    [-2n, "-2"],
  ] as const)("groups a negative literal base %s before exponentiation", (value, text) => {
    expect(returnSource({ kind: "binary", op: "^", left: lit(value), right: lit(2) })).toBe(
      `return (${text}) ^ 2\n`,
    );
  });

  it("keeps standalone conditional returns readable", () => {
    expect(returnSource(conditional)).toBe("return if flag then left else right\n");
  });

  it("groups a conditional used as the left operand of a binary expression", () => {
    expect(returnSource({ kind: "binary", op: "+", left: conditional, right: lit(1) })).toBe(
      "return (if flag then left else right) + 1\n",
    );
  });

  it("groups a conditional used as the right operand of a binary expression", () => {
    expect(returnSource({ kind: "binary", op: "*", left: ident("scale"), right: conditional })).toBe(
      "return scale * (if flag then left else right)\n",
    );
  });

  it("groups a conditional under unary not", () => {
    expect(returnSource({ kind: "unary", op: "not", argument: conditional })).toBe(
      "return not (if flag then left else right)\n",
    );
  });

  it("preserves the precedence of arithmetic nested in a conditional branch", () => {
    expect(returnSource({
      kind: "if-expr",
      test: ident("flag"),
      consequent: { kind: "binary", op: "+", left: ident("a"), right: ident("b") },
      branches: [],
      alternate: ident("c"),
    })).toBe("return if flag then a + b else c\n");
  });
});
