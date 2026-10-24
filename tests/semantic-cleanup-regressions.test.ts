import { describe, expect, it } from "vitest";
import { block, chunk, ident, lit, type Expression } from "../src/ast/Ast.ts";
import { cleanupAst, type CleanupOptions } from "../src/ast/AstCleanup.ts";
import { printLuau } from "../src/print/LuauPrinter.ts";

const options: CleanupOptions = {
  typeAnnotations: "off", ifExpressions: true, earlyReturn: false,
  interpolatedStrings: false, mathConstants: false,
};
const call = (name: string): Expression => ({ kind: "call", callee: ident(name), args: [], open: false });

describe("cleanup preserves observable values and effects", () => {
  it.each(["call", "method-call", "vararg"] as const)("keeps an open %s return out of a single-valued if expression", (kind) => {
    const value: Expression = kind === "call" ? call("many") : kind === "vararg" ? { kind } :
      { kind, object: ident("object"), name: "many", args: [], open: false };
    const ast = chunk([{
      kind: "if", test: ident("flag"), branches: [],
      consequent: block([{ kind: "return", values: [value] }]),
      alternate: block([{ kind: "return", values: [lit(0)] }]),
    }]);
    const source = printLuau(cleanupAst(ast, options));
    expect(source).toContain("if flag then\n");
    expect(source).not.toContain("return if");
  });

  it("evaluates a computed table key even when its value is nil", () => {
    const ast = chunk([{ kind: "return", values: [{
      kind: "table", fields: [{ key: call("key"), value: lit(null) }],
    }] }]);
    expect(printLuau(cleanupAst(ast, options))).toContain("[key()] = nil");
  });
});

it("keeps a nested continue that skips the enclosing block's remaining effects", () => {
  const ast = chunk([{ kind: "while", test: ident("running"), body: block([
    { kind: "if", test: ident("inside"), branches: [], consequent: block([
      { kind: "if", test: ident("skip"), branches: [], consequent: block([{ kind: "continue" }]) },
      { kind: "expression-stmt", expression: call("inner") },
    ]) },
    { kind: "expression-stmt", expression: call("tail") },
  ]) }]);
  const source = printLuau(cleanupAst(ast, options));
  expect(source).toContain("continue");
  expect(source).toContain("inner()");
  expect(source).toContain("tail()");
});
