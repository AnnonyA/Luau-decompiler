import { describe, expect, it } from "vitest";
import { block, chunk, ident, lit, type Statement } from "../src/ast/Ast.ts";
import { cleanupAst, type CleanupOptions } from "../src/ast/AstCleanup.ts";
import { validateAst } from "../src/ast/AstValidator.ts";
import { printLuau } from "../src/print/LuauPrinter.ts";

const options: CleanupOptions = {
  typeAnnotations: "off",
  ifExpressions: false,
  earlyReturn: true,
  interpolatedStrings: false,
  mathConstants: false,
};

function call(name: string): Statement {
  return {
    kind: "expression-stmt",
    expression: { kind: "call", callee: ident("print"), args: [ident(name)], open: false },
  };
}

function condition(elseStatements: Statement[]): Statement {
  return {
    kind: "if",
    test: ident("done"),
    consequent: block([{ kind: "return", values: [lit(1)] }]),
    branches: [],
    alternate: block(elseStatements),
  };
}

function clean(...statements: Statement[]): string {
  const result = cleanupAst(chunk(statements), options);
  expect(validateAst(result)).toEqual([]);
  return printLuau(result);
}

describe("early return cleanup respects else lexical scopes", () => {
  it("does not hoist an else-local into the outer block", () => {
    const source = clean(
      { kind: "local", names: ["value"], values: [lit(0)] },
      condition([
        { kind: "local", names: ["value"], values: [lit(2)] },
        call("value"),
      ]),
      { kind: "return", values: [ident("value")] },
    );
    expect(source).toContain("if done then");
    expect(source).toMatch(/else\n\s+local value\d* = 2/);
    expect(source).toMatch(/end\nreturn value/);
  });

  it("does not expose a local function defined only in else", () => {
    const fn: Statement = {
      kind: "function-decl", local: true, name: "helper",
      params: [], isVararg: false,
      body: block([{ kind: "return", values: [lit(3)] }]),
    };
    const source = clean(condition([fn, call("helper")]), call("done"));
    expect(source).toContain("if done then");
    expect(source).toMatch(/else\n\s+local function helper/);
    expect(source).toMatch(/end\nprint\(done\)/);
  });

  it("still flattens ordinary else statements after a guaranteed early return", () => {
    const source = clean(condition([call("value")]), call("done"));
    expect(source).toContain("if done then");
    expect(source).not.toContain("else");
    expect(source).toContain("print(value)");
    expect(source).toContain("print(done)");
  });

  it("may flatten a nested do-block because its locals retain their own scope", () => {
    const source = clean(condition([{
      kind: "do",
      body: block([{ kind: "local", names: ["inside"], values: [lit(4)] }, call("inside")]),
    }]), call("outside"));
    expect(source).not.toContain("else");
    expect(source).toContain("do");
    expect(source).toContain("local inside = 4");
  });
});
