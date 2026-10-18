import { describe, expect, it } from "vitest";
import { block, chunk, ident, lit, type Expression, type Statement } from "../src/ast/Ast.ts";
import { inferHumanNames } from "../src/reconstruct/NameInference.ts";
import { printLuau } from "../src/print/LuauPrinter.ts";

function recoveredClosure(): Expression {
  return {
    kind: "function-expr",
    params: [],
    isVararg: false,
    body: block([
      {
        kind: "local",
        names: ["value"],
        values: [{ kind: "property", object: ident("math"), name: "clamp" }],
      },
      {
        kind: "assign",
        targets: [ident("value")],
        values: [{
          kind: "call",
          callee: ident("value"),
          args: [lit(10), lit(0), lit(20)],
          open: false,
        }],
      },
      { kind: "return", values: [ident("value")] },
    ]),
  };
}

function print(statements: Statement[]): string {
  return printLuau(inferHumanNames(chunk(statements)));
}

function expectFoldedNestedCall(source: string, count = 1): void {
  expect((source.match(/math\.clamp\(10, 0, 20\)/g) ?? [])).toHaveLength(count);
  expect(source).not.toMatch(/= math\.clamp\s*\n/);
}

describe("recovery of closures nested in expressions", () => {
  it("folds temporary call aliases in a function returned directly", () => {
    expectFoldedNestedCall(print([{ kind: "return", values: [recoveredClosure()] }]));
  });

  it("folds functions inside every branch of an if expression", () => {
    const expr: Expression = {
      kind: "if-expr",
      test: ident("flag"),
      consequent: recoveredClosure(),
      branches: [{ test: ident("other"), value: recoveredClosure() }],
      alternate: recoveredClosure(),
    };
    expectFoldedNestedCall(print([{ kind: "return", values: [expr] }]), 3);
  });

  it("folds functions wrapped in parentheses", () => {
    const expr: Expression = { kind: "paren", expression: recoveredClosure() };
    expectFoldedNestedCall(print([{ kind: "local", names: ["callback"], values: [expr] },
      { kind: "return", values: [ident("callback")] }]));
  });

  it("folds functions used within a condition's call expression", () => {
    const test: Expression = { kind: "call", callee: recoveredClosure(), args: [], open: false };
    expectFoldedNestedCall(print([{ kind: "if", test, consequent: block([{ kind: "return", values: [lit(1)] }]), branches: [] }]));
  });

  it("folds functions inside interpolated expressions", () => {
    const expr: Expression = { kind: "interp", parts: [{ kind: "expr", value: recoveredClosure() }] };
    expectFoldedNestedCall(print([{ kind: "return", values: [expr] }]));
  });
});
