import { describe, expect, it } from "vitest";
import { chunk, ident, lit, type Expression } from "../src/ast/Ast.ts";
import { cleanupAst, type CleanupOptions } from "../src/ast/AstCleanup.ts";
import { validateAst } from "../src/ast/AstValidator.ts";
import { printLuau } from "../src/print/LuauPrinter.ts";

const options: CleanupOptions = {
  typeAnnotations: "off",
  ifExpressions: false,
  earlyReturn: false,
  interpolatedStrings: true,
  mathConstants: false,
};

function formatCall(template: string, ...args: Expression[]): Expression {
  return {
    kind: "call",
    callee: { kind: "property", object: ident("string"), name: "format" },
    args: [lit(template), ...args],
    open: false,
  };
}

function cleanReturn(value: Expression): string {
  return printLuau(cleanupAst(chunk([{ kind: "return", values: [value] }]), options));
}

describe("recovered AST expression fidelity", () => {
  it("transforms nested elseif tests and values, not just the first and last branches", () => {
    const conditional: Expression = {
      kind: "if-expr",
      test: ident("flag"),
      consequent: lit("yes"),
      branches: [{
        test: { kind: "binary", op: "<", left: lit(1), right: ident("count") },
        value: formatCall("value: %s", { kind: "binary", op: "<", left: lit(2), right: ident("count") }),
      }],
      alternate: lit("no"),
    };
    const source = cleanReturn(conditional);
    expect(source).toContain("elseif count > 1 then");
    expect(source).toContain('string.format("value: %s", count > 2)');
  });

  it("validates invalid identifiers inside elseif tests and values", () => {
    const ast = chunk([{ kind: "return", values: [{
      kind: "if-expr",
      test: ident("ok"),
      consequent: lit(1),
      branches: [{ test: ident("bad-test"), value: ident("bad-value") }],
      alternate: lit(0),
    }] }]);
    expect(validateAst(ast)).toEqual([
      { code: "identifier", message: "invalid identifier bad-test" },
      { code: "identifier", message: "invalid identifier bad-value" },
    ]);
  });

  it("preserves numeric format specifiers rather than changing the result", () => {
    for (const format of ["%d", "%i", "%f", "%.2f", "%02d", "%+d"]) {
      const source = cleanReturn(formatCall(format, lit(3.5)));
      expect(source).toContain("string.format(");
      expect(source).toContain(JSON.stringify(format));
    }
  });

  it("rejects unknown, incomplete or escaped-percent patterns for rewriting", () => {
    for (const format of ["rate: %q", "trailing %", "value: %s, ratio: %f"]) {
      const source = cleanReturn(formatCall(format, ident("value")));
      expect(source).toContain("string.format(");
    }
  });

  it("retains string placeholders and literal percent escapes in formatting calls", () => {
    expect(cleanReturn(formatCall("Name: %s (100%%)", ident("name")))).toBe(
      'return string.format("Name: %s (100%%)", name)\n',
    );
  });

  it("does not rewrite a user-defined function named format", () => {
    const expr: Expression = {
      kind: "call",
      callee: ident("format"),
      args: [lit("%s"), ident("name")],
      open: false,
    };
    expect(cleanReturn(expr)).toBe('return format("%s", name)\n');
  });
});
