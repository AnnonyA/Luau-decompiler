import { describe, expect, it } from "vitest";
import { chunk, ident, lit, block, type Statement } from "../src/ast/Ast.ts";
import { cleanupAst, type CleanupOptions } from "../src/ast/AstCleanup.ts";
import { validateAst } from "../src/ast/AstValidator.ts";
import { printLuau } from "../src/print/LuauPrinter.ts";

const options: CleanupOptions = {
  typeAnnotations: "off",
  ifExpressions: true,
  earlyReturn: false,
  interpolatedStrings: false,
  mathConstants: false,
};

function choice(thenStatement: Statement, elseStatement: Statement): Statement {
  return {
    kind: "if",
    test: ident("flag"),
    consequent: block([thenStatement]),
    branches: [],
    alternate: block([elseStatement]),
  };
}

function local(name: string, value: number): Statement {
  return { kind: "local", names: [name], values: [lit(value)] };
}

function assign(name: string, value: number): Statement {
  return { kind: "assign", targets: [ident(name)], values: [lit(value)] };
}

function cleaned(...statements: Statement[]): string {
  const ast = cleanupAst(chunk(statements), options);
  expect(validateAst(ast)).toEqual([]);
  return printLuau(ast);
}

describe("if expression recovery preserves lexical scopes", () => {
  it("does not hoist two branch-local variables into the enclosing scope", () => {
    const source = cleaned(choice(local("choice", 1), local("choice", 2)),
      { kind: "return", values: [ident("choice")] });
    expect(source).toContain("if flag then");
    expect(source).toContain("local choice = 1");
    expect(source).toMatch(/local choice\d* = 2/);
    expect(source).not.toContain("local choice = if flag");
  });

  it("does not turn a branch-local declaration into a write to an outer variable", () => {
    const source = cleaned(
      local("choice", 0),
      choice(local("choice", 1), assign("choice", 2)),
      { kind: "return", values: [ident("choice")] },
    );
    expect(source).toMatch(/local choice\d* = 1/);
    expect(source).toContain("choice = 2");
    expect(source).not.toContain("choice = if flag then");
  });

  it("does not turn a branch assignment into a new out-of-branch local", () => {
    const source = cleaned(choice(assign("choice", 1), local("choice", 2)));
    expect(source).toContain("choice = 1");
    expect(source).toContain("local choice = 2");
    expect(source).not.toContain("choice = if flag then");
  });

  it("still recovers a single conditional assignment to an existing identifier", () => {
    const source = cleaned(local("choice", 0), choice(assign("choice", 1), assign("choice", 2)),
      { kind: "return", values: [ident("choice")] });
    expect(source).toContain("choice = if flag then 1 else 2");
    expect(source).not.toContain("if flag then\n");
  });

  it("does not combine writes to two different identifiers", () => {
    const source = cleaned(choice(assign("first", 1), assign("second", 2)));
    expect(source).toContain("first = 1");
    expect(source).toContain("second = 2");
    expect(source).not.toContain("= if flag");
  });
});
