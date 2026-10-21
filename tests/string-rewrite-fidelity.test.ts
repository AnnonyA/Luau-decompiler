import { describe, expect, it } from "vitest";
import { chunk, ident, lit, type Expression } from "../src/ast/Ast.ts";
import { cleanupAst } from "../src/ast/AstCleanup.ts";
import { printLuau } from "../src/print/LuauPrinter.ts";

const options = {
  typeAnnotations: "off" as const, ifExpressions: false, earlyReturn: false,
  interpolatedStrings: true, mathConstants: false,
};
const concat = (left: Expression, right: Expression): Expression => ({ kind: "binary", op: "..", left, right });
const source = (value: Expression) => printLuau(cleanupAst(chunk([{ kind: "return", values: [value] }]), options));

describe("string rewrites preserve runtime operations", () => {
  it.each<Expression>([
    ident("value"),
    { kind: "property", object: ident("object"), name: "value" },
    { kind: "call", callee: ident("get"), args: [], open: false },
    { kind: "method-call", object: ident("object"), name: "get", args: [], open: false },
  ])("keeps concatenation for operands with unknown runtime types: %j", (value) => {
    const result = source(concat(lit("prefix:"), value));
    expect(result).toContain('"prefix:" .. ');
    expect(result).not.toContain("`");
  });

  it("keeps dynamic nested concatenations and their association", () => {
    expect(source(concat(lit("a"), concat(ident("left"), ident("right")))))
      .toBe('return "a" .. left .. right\n');
  });

  it("can still interpolate concatenations of statically known strings", () => {
    expect(source(concat(lit("hello "), lit("world")))).toBe('return `hello world`\n');
    const interpolated: Expression = { kind: "interp", parts: [{ kind: "expr", value: ident("value") }] };
    expect(source(concat(lit("prefix:"), interpolated))).toBe('return `prefix:{`{value}`}`\n');
  });

  it.each([ident("value"), lit(true), lit("literal")])("keeps string.format even for %j", (value) => {
    const result = source({
      kind: "call", callee: { kind: "property", object: ident("string"), name: "format" },
      args: [lit("value: %s (100%%)"), value], open: false,
    });
    // The AST does not establish that `string` is the builtin library. Even
    // literal arguments do not justify erasing the property lookup and call.
    expect(result).toContain('string.format("value: %s (100%%)", ');
    expect(result).not.toContain("`");
  });
});

describe("interpolation literal escaping", () => {
  function text(value: string) {
    return printLuau(chunk([{ kind: "return", values: [{ kind: "interp", parts: [{ kind: "text", value }] }] }]));
  }

  it("escapes newlines, carriage returns and tabs", () => {
    expect(text("a\nb\r\tc")).toBe('return `a\\nb\\r\\tc`\n');
  });

  it("uses fixed-width escapes for control bytes before decimal digits", () => {
    expect(text("\0" + "12\x01" + "23\x1f" + "45")).toBe('return `\\00012\\00123\\03145`\n');
  });

  it("preserves delimiters, backslashes and Unicode", () => {
    expect(text("\\n`{x}é🙂")).toBe('return `\\\\n\\`\\{x}é🙂`\n');
  });
});
