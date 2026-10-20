import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { chunk, ident, lit, type Expression } from "../src/ast/Ast.ts";
import { decompile } from "../src/decompile.ts";
import { printLuau } from "../src/print/LuauPrinter.ts";

const returned = (value: Expression) =>
  printLuau(chunk([{ kind: "return", values: [value] }]));

describe("Luau member syntax on literal receivers", () => {
  it("parenthesizes a literal receiver before a colon method call", () => {
    const source = returned({
      kind: "method-call",
      object: lit("Role: %*"),
      name: "format",
      args: [ident("role")],
      open: false,
    });
    expect(source).toBe('return ("Role: %*"):format(role)\n');
  });

  it("parenthesizes string literals before dot property access", () => {
    expect(returned({ kind: "property", object: lit("text"), name: "foo" }))
      .toBe('return ("text").foo\n');
  });

  it("parenthesizes numeric literals before bracket indexing", () => {
    expect(returned({ kind: "index", table: lit(42), key: lit("foo") }))
      .toBe('return (42)["foo"]\n');
  });

  it("avoids grouping already parenthesized and ordinary identifier receivers", () => {
    const method = (object: Expression) => returned({
      kind: "method-call", object, name: "format", args: [], open: false,
    });
    expect(method({ kind: "paren", expression: lit("text") }))
      .toBe('return ("text"):format()\n');
    expect(method(ident("value"))).toBe("return value:format()\n");
  });

  it("recovers valid literal format calls from the actual luac.bin fixture", () => {
    const bytes = readFileSync(new URL("./luac.bin", import.meta.url));
    const result = decompile(bytes);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.source).toContain('("Callable(calls=%*)"):format(self.calls)');
      expect(result.source).not.toContain('"Callable(calls=%*)":format');
    }
  });

  it("recovers valid literal format calls from the actual IndexUI fixture", () => {
    const bytes = readFileSync(new URL("./IndexUI_ModuleScript_Bytecode.txt", import.meta.url));
    const result = decompile(bytes);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.source).toContain('("Role: %*"):format');
      expect(result.source).not.toContain('"Role: %*":format');
      expect(result.source).toContain('("Unlocks at rebirth %*!"):format');
    }
  });
});
