import { describe, expect, it } from "vitest";
import { block, chunk, ident, lit, type FunctionDeclaration, type FunctionExpression, type Statement } from "../src/ast/Ast.ts";
import { printLuau } from "../src/print/LuauPrinter.ts";

const fn = (name: string, statements: Statement[], params: string[] = []): FunctionDeclaration =>
  ({ kind: "function-decl", local: true, name, params, isVararg: false, body: block(statements) });
const closure = (statements: Statement[]): FunctionExpression =>
  ({ kind: "function-expr", params: [], isVararg: false, body: block(statements) });

describe("printer rewrite options", () => {
  it("keeps default Unicode and omits optional annotations and const", () => {
    const ast = chunk([{ kind: "local", names: ["label"], values: [lit("é🙂")] },
      { ...fn("read", [{ kind: "return", values: [ident("label")] }]), line: 14 }]);
    expect(printLuau(ast)).toBe('local label = "é🙂"\n\nlocal function read()\n    return label\nend\n');
  });

  it("escapes Unicode as exact UTF-8 bytes while preserving invalid bytes and decimal suffixes", () => {
    const ast = chunk([{ kind: "return", values: [lit("é🙂\u{10080}\udcff\0" + "12")] }]);
    expect(printLuau(ast, { unicodeStrings: false })).toBe('return "\\195\\169\\240\\159\\153\\130\\240\\144\\130\\128\\255\\00012"\n');
  });

  it("applies Unicode escaping to interpolation text, nested strings, table names and property names", () => {
    const ast = chunk([{ kind: "return", values: [
      { kind: "interp", parts: [{ kind: "text", value: "é{`\\\udcff" }, { kind: "expr", value: lit("🙂") }] },
      { kind: "table", fields: [{ name: "é", value: lit("é") }] },
      { kind: "property", object: ident("obj"), name: "é" },
    ] }]);
    expect(printLuau(ast, { unicodeStrings: false })).toBe('return `\\195\\169\\{\\`\\\\\\255{"\\240\\159\\153\\130"}`, { ["\\195\\169"] = "\\195\\169" }, obj["\\195\\169"]\n');
  });

  it("prints actual captures and forwards them through intermediate closures without listing globals or shadows", () => {
    const ast = chunk([
      { kind: "local", names: ["outside", "shadow"], values: [lit(1), lit(2)] },
      fn("middle", [{ kind: "return", values: [closure([
        { kind: "return", values: [ident("outside"), ident("shadow"), ident("globalName")] },
      ])] }], ["shadow"]),
    ]);
    const output = printLuau(ast, { upvalueComments: true });
    expect(output).toContain("local function middle(shadow)\n    -- Upvalues: outside\n");
    expect(output).toContain("return function()\n        -- Upvalues: outside, shadow\n");
    expect(output).not.toContain("Upvalues: globalName");
  });

  it("recognizes write-only captures and recursive local functions", () => {
    const ast = chunk([{ kind: "local", names: ["value"], values: [lit(0)] },
      fn("recur", [{ kind: "assign", targets: [ident("value")], values: [lit(2)] },
        { kind: "return", values: [ident("recur")] }])]);
    expect(printLuau(ast, { upvalueComments: true })).toContain("-- Upvalues: value, recur\n");
  });

  it("prints only known positive source lines for declarations and expressions", () => {
    const ast = chunk([{ ...fn("known", [{ kind: "return", values: [{ ...closure([]), line: 27 }] }]), line: 12 },
      { ...fn("unknown", []), line: 0 }, fn("absent", [])]);
    const output = printLuau(ast, { functionLineComments: true });
    expect(output).toContain("local function known()\n    -- Line: 12\n");
    expect(output).toContain("return function()\n        -- Line: 27\n");
    expect(output.match(/-- Line:/g)).toHaveLength(2);
  });

  it("does not allow line breaks from capture labels to escape comments", () => {
    const label = "value\r\ninjected()\u2028more";
    const output = printLuau(chunk([{ kind: "local", names: [label], values: [lit(1)] },
      fn("read", [{ kind: "return", values: [ident(label)] }])]), { upvalueComments: true });
    const comment = output.split("\n").find(line => line.includes("-- Upvalues:"));
    expect(comment).toBe("    -- Upvalues: value  injected() more");
  });

  it("prefers const for immutable locals while retaining writes inside closures", () => {
    const ast = chunk([
      { kind: "local", names: ["fixed"], values: [lit(1)], types: ["number"] },
      { kind: "local", names: ["mutable"], values: [lit(2)] },
      fn("change", [{ kind: "compound-assign", target: ident("mutable"), op: "+", value: lit(1) },
        { kind: "return", values: [ident("fixed")] }]),
    ]);
    const output = printLuau(ast, { preferConst: true });
    expect(output).toContain("const fixed: number = 1\nlocal mutable = 2\n\nlocal function change()");
  });

  it("resolves same-named locals independently and propagates options to function expressions", () => {
    const ast = chunk([{ kind: "local", names: ["value"], values: [lit(1)] },
      { kind: "return", values: [closure([
        { kind: "local", names: ["value"], values: [lit(2)] },
        { kind: "assign", targets: [ident("value")], values: [lit(3)] },
        { kind: "local", names: ["label"], values: [lit("é")] },
      ])] }]);
    expect(printLuau(ast, { preferConst: true, unicodeStrings: false })).toBe(
      'const value = 1\nreturn function()\n    local value = 2\n    value = 3\n    const label = "\\195\\169"\nend\n');
  });

  it("requires every binding in a declaration to have no writes and enough initializers", () => {
    const ast = chunk([
      { kind: "local", names: ["first", "second"], values: [lit(1), lit(2)] },
      { kind: "assign", targets: [ident("second")], values: [lit(3)] },
      { kind: "local", names: ["uninitialized"], values: [] },
      { kind: "local", names: ["a", "b"], values: [lit(1)] },
      { kind: "local", names: ["extra"], values: [lit(1), lit(2)] },
      { kind: "local", names: ["x", "y"], values: [{ kind: "call", callee: ident("pair"), args: [], open: true }] },
    ]);
    expect(printLuau(ast, { preferConst: true })).toBe("local first, second = 1, 2\nsecond = 3\nlocal uninitialized\nlocal a, b = 1\nlocal extra = 1, 2\nconst x, y = pair()\n");
  });

  it("permits table mutation but retains a local assigned by a function declaration", () => {
    const ast = chunk([{ kind: "local", names: ["obj"], values: [{ kind: "table", fields: [] }] },
      { kind: "assign", targets: [{ kind: "property", object: ident("obj"), name: "value" }], values: [lit(1)] },
      { kind: "local", names: ["callback"], values: [lit(null)] },
      { ...fn("callback", []), local: false }]);
    const output = printLuau(ast, { preferConst: true });
    expect(output).toContain("const obj = {}\nobj.value = 1\nlocal callback = nil\nfunction callback()");
  });
});
