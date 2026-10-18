import { describe, expect, it } from "vitest";
import { block, chunk, ident, lit, type Expression } from "../src/ast/Ast.ts";
import { inferHumanNames } from "../src/reconstruct/NameInference.ts";
import { printLuau } from "../src/print/LuauPrinter.ts";

function source(statements: Parameters<typeof chunk>[0]): string {
  return printLuau(inferHumanNames(chunk(statements)));
}

describe("captured generated local lifetimes", () => {
  it("preserves an initializer observed by a nested function before reassignment", () => {
    const fn: Expression = {
      kind: "function-expr",
      params: [],
      isVararg: false,
      body: block([{ kind: "return", values: [ident("value")] }]),
    };
    const output = source([
      { kind: "local", names: ["value"], values: [lit(5)] },
      { kind: "local", names: ["callback"], values: [fn] },
      { kind: "assign", targets: [ident("value")], values: [lit(7)] },
      { kind: "return", values: [ident("callback")] },
    ]);
    expect(output).toMatch(/local \w+ = 5/);
    expect(output).toMatch(/= 7/);
    expect(output.indexOf("= 5")).toBeLessThan(output.indexOf("function("));
    expect(output.indexOf("function(")).toBeLessThan(output.indexOf("= 7"));
  });

  it("preserves an initializer used by a nested function declaration", () => {
    const output = source([
      { kind: "local", names: ["value"], values: [lit(5)] },
      { kind: "function-decl", local: true, name: "readValue", params: [], isVararg: false,
        body: block([{ kind: "return", values: [ident("value")] }]) },
      { kind: "assign", targets: [ident("value")], values: [lit(7)] },
      { kind: "return", values: [ident("readValue")] },
    ]);
    expect(output).toContain("= 5");
    expect(output).toContain("= 7");
  });

  it("counts references inside interpolated strings before overwriting locals", () => {
    const interpolation: Expression = {
      kind: "interp",
      parts: [
        { kind: "text", value: "initial: " },
        { kind: "expr", value: ident("value") },
      ],
    };
    const output = source([
      { kind: "local", names: ["value"], values: [lit(5)] },
      { kind: "local", names: ["result"], values: [interpolation] },
      { kind: "assign", targets: [ident("value")], values: [lit(7)] },
      { kind: "return", values: [ident("result")] },
    ]);
    expect(output).toContain("= 5");
    expect(output).toContain("initial:");
    expect(output).toContain("= 7");
  });
});
