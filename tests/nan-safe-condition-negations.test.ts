import { describe, expect, it } from "vitest";
import { chunk, ident, lit, type BinaryOperator, type Expression } from "../src/ast/Ast.ts";
import { cleanupAst, type CleanupOptions } from "../src/ast/AstCleanup.ts";
import { printLuau } from "../src/print/LuauPrinter.ts";

const options: CleanupOptions = {
  typeAnnotations: "off",
  ifExpressions: false,
  earlyReturn: false,
  interpolatedStrings: false,
  mathConstants: false,
};

function clean(expression: Expression): string {
  return printLuau(cleanupAst(chunk([{ kind: "return", values: [expression] }]), options));
}

function negated(op: BinaryOperator): Expression {
  return {
    kind: "unary",
    op: "not",
    argument: { kind: "binary", op, left: ident("left"), right: ident("right") },
  };
}

describe("NaN-safe cleanup of comparison negations", () => {
  it.each(["<", "<=", ">", ">="] as const)(
    "preserves not (%s) rather than flipping the ordering comparison",
    (op) => {
      // Luau and IEEE-754 comparisons with NaN are unordered: both a < b
      // and a >= b are false, so their negations differ.
      expect(clean(negated(op))).toBe(`return not (left ${op} right)\n`);
    },
  );

  it("keeps strict equality negation as inequality", () => {
    expect(clean(negated("=="))).toBe("return left ~= right\n");
  });

  it("keeps inequality negation as equality", () => {
    expect(clean(negated("~="))).toBe("return left == right\n");
  });

  it("still removes a double not", () => {
    expect(clean({ kind: "unary", op: "not", argument: { kind: "unary", op: "not", argument: ident("ready") } }))
      .toBe("return ready\n");
  });

  it("keeps plain identifier negation", () => {
    expect(clean({ kind: "unary", op: "not", argument: ident("ready") }))
      .toBe("return not ready\n");
  });

  it("does not change a normal ordering comparison without a not", () => {
    expect(clean({ kind: "binary", op: "<", left: ident("left"), right: lit(3) }))
      .toBe("return left < 3\n");
  });
});
