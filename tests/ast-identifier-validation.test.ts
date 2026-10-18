import { describe, expect, it } from "vitest";
import { chunk, ident, lit, type Expression } from "../src/ast/Ast.ts";
import { validateAst } from "../src/ast/AstValidator.ts";
import { printLuau } from "../src/print/LuauPrinter.ts";

function returned(expression: Expression) {
  return chunk([{ kind: "return", values: [expression] }]);
}

describe("AST identifier and property validation", () => {
  it.each(["foo-bar", "end", "type", "export", "some space"])(
    "accepts string property keys represented with bracket syntax: %s",
    (name) => {
      const ast = returned({ kind: "property", object: ident("object"), name });
      expect(validateAst(ast)).toEqual([]);
      expect(printLuau(ast)).toContain(`object[${JSON.stringify(name)}]`);
    },
  );

  it.each(["type", "export"])("rejects Luau reserved keywords in local bindings: %s", (name) => {
    const ast = chunk([{ kind: "local", names: [name], values: [lit(1)] }]);
    expect(validateAst(ast)).toContainEqual({
      code: "identifier",
      message: `invalid binding ${name}`,
    });
  });

  it.each(["type", "export"])("rejects reserved keywords as plain identifiers: %s", (name) => {
    expect(validateAst(returned(ident(name)))).toContainEqual({
      code: "identifier",
      message: `invalid identifier ${name}`,
    });
  });

  it.each(["foo-bar", "end", "type"])(
    "rejects invalid method names instead of producing invalid colon syntax: %s",
    (name) => {
      const ast = returned({
        kind: "method-call",
        object: ident("object"),
        name,
        args: [],
        open: false,
      });
      expect(validateAst(ast)).toContainEqual({
        code: "identifier",
        message: `invalid method ${name}`,
      });
    },
  );

  it("keeps ordinary method calls and valid locals unchanged", () => {
    const ast = chunk([
      { kind: "local", names: ["data"], values: [lit(1)] },
      { kind: "return", values: [{ kind: "method-call", object: ident("service"), name: "GetService", args: [lit("Players")], open: false }] },
    ]);
    expect(validateAst(ast)).toEqual([]);
    expect(printLuau(ast)).toContain('service:GetService("Players")');
  });
});
