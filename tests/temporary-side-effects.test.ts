import { describe, expect, it } from "vitest";
import { chunk, ident, lit, type Expression } from "../src/ast/Ast.ts";
import { inferHumanNames } from "../src/reconstruct/NameInference.ts";
import { printLuau } from "../src/print/LuauPrinter.ts";

function withOverwrittenInitializer(value: Expression): string {
  return printLuau(inferHumanNames(chunk([
    { kind: "local", names: ["value"], values: [value] },
    { kind: "assign", targets: [ident("value")], values: [lit(9)] },
    { kind: "return", values: [ident("value")] },
  ])));
}

describe("temporary assignment side effects", () => {
  it("does not discard an earlier call when its result is overwritten", () => {
    const source = withOverwrittenInitializer({
      kind: "call", callee: ident("recordEvent"), args: [lit("first")], open: false,
    });
    expect(source).toContain('recordEvent("first")');
    expect(source.indexOf("recordEvent")).toBeLessThan(source.indexOf("= 9"));
  });

  it("does not discard property accesses that may trigger __index metamethods", () => {
    const source = withOverwrittenInitializer({
      kind: "property", object: ident("object"), name: "state",
    });
    expect(source).toContain("object.state");
    expect(source.indexOf("object.state")).toBeLessThan(source.indexOf("= 9"));
  });

  it("does not discard indexed reads that may trigger __index metamethods", () => {
    const source = withOverwrittenInitializer({
      kind: "index", table: ident("object"), key: lit("tracked"),
    });
    expect(source).toContain('object["tracked"]');
    expect(source.indexOf('object["tracked"]')).toBeLessThan(source.indexOf("= 9"));
  });

  it("does not discard arithmetic that may dispatch overloaded operators", () => {
    const source = withOverwrittenInitializer({
      kind: "binary", op: "+", left: ident("object"), right: lit(1),
    });
    expect(source).toContain("object + 1");
    expect(source.indexOf("object + 1")).toBeLessThan(source.indexOf("= 9"));
  });

  it("does not discard reads from an environment with a possible __index metamethod", () => {
    const source = withOverwrittenInitializer(ident("globalBinding"));
    expect(source).toContain("globalBinding");
    expect(source.indexOf("globalBinding")).toBeLessThan(source.indexOf("= 9"));
  });

  it("still eliminates a genuinely unused literal initializer", () => {
    const source = withOverwrittenInitializer(lit(42));
    expect(source).not.toMatch(/\b42\b/);
    expect(source).toContain("= 9");
  });
});
