import { describe, expect, it } from "vitest";
import { cleanupAst } from "../src/ast/AstCleanup.ts";
import { chunk, ident, lit } from "../src/ast/Ast.ts";
import { printLuau } from "../src/print/LuauPrinter.ts";
import { abc, ad, Opcode, proto, sourceOf, strings, importConst, ret } from "./helpers.ts";
import { decompile } from "../src/decompile.ts";
import { compile } from "./helpers.ts";

describe("semantic reconstruction", () => {
  it("names GetService results and annotates their type", () => {
    const source = sourceOf(
      proto({
        maxStackSize: 4,
        constants: [...strings("game", "GetService", "Players"), importConst(["game"])],
        instructions: [
          ad(Opcode.GETIMPORT, 0, 3),
          0x40000000,
          ad(Opcode.LOADK, 3, 2),
          abc(Opcode.NAMECALL, 1, 0, 0),
          1,
          abc(Opcode.CALL, 1, 3, 2),
          ret(),
        ],
        locals: [{ name: "Players", startPc: 6, endPc: 7, register: 1 }],
      }),
    );
    expect(source).toMatch(/game:GetService\("Players"\)/);
    expect(source).toMatch(/Players: Players/);
  });

  it("recovers an if-expression from a diamond assignment", () => {
    const ast = cleanupAst(
      chunk([
        {
          kind: "if",
          test: ident("flag"),
          consequent: { kind: "block", statements: [{ kind: "assign", targets: [ident("color")], values: [ident("red")] }] },
          branches: [],
          alternate: { kind: "block", statements: [{ kind: "assign", targets: [ident("color")], values: [ident("blue")] }] },
        },
      ]),
      {
        typeAnnotations: "off",
        ifExpressions: true,
        earlyReturn: true,
        interpolatedStrings: true,
        mathConstants: true,
      },
    );
    expect(printLuau(ast)).toContain("color = if flag then red else blue");
  });

  it("flattens else/if into elseif", () => {
    const ast = cleanupAst(
      chunk([
        {
          kind: "if",
          test: ident("a"),
          consequent: { kind: "block", statements: [{ kind: "return", values: [lit(1)] }] },
          branches: [],
          alternate: {
            kind: "block",
            statements: [
              {
                kind: "if",
                test: ident("b"),
                consequent: { kind: "block", statements: [{ kind: "return", values: [lit(2)] }] },
                branches: [],
              },
            ],
          },
        },
      ]),
      {
        typeAnnotations: "off",
        ifExpressions: false,
        earlyReturn: true,
        interpolatedStrings: false,
        mathConstants: false,
      },
    );
    const source = printLuau(ast);
    expect(source).toMatch(/elseif b then/);
    expect(source).not.toMatch(/else\n    if b then/);
  });

  it("turns string.format into an interpolated string", () => {
    const ast = cleanupAst(
      chunk([
        {
          kind: "return",
          values: [
            {
              kind: "call",
              callee: { kind: "property", object: ident("string"), name: "format" },
              args: [lit("Hello, %s"), ident("name")],
              open: false,
            },
          ],
        },
      ]),
      {
        typeAnnotations: "off",
        ifExpressions: false,
        earlyReturn: false,
        interpolatedStrings: true,
        mathConstants: false,
      },
    );
    expect(printLuau(ast)).toContain("`Hello, {name}`");
  });

  it("prints math.pi instead of the raw literal", () => {
    const ast = cleanupAst(chunk([{ kind: "return", values: [lit(Math.PI)] }]), {
      typeAnnotations: "off",
      ifExpressions: false,
      earlyReturn: false,
      interpolatedStrings: false,
      mathConstants: true,
    });
    expect(printLuau(ast)).toContain("math.pi");
  });

  it("names Connect callbacks from PlayerAdded", () => {
    const ast = cleanupAst(
      chunk([
        {
          kind: "expression-stmt",
          expression: {
            kind: "method-call",
            object: { kind: "property", object: ident("Players"), name: "PlayerAdded" },
            name: "Connect",
            args: [
              {
                kind: "function-expr",
                params: ["value"],
                isVararg: false,
                body: { kind: "block", statements: [{ kind: "return", values: [ident("value")] }] },
              },
            ],
            open: false,
          },
        },
      ]),
      {
        typeAnnotations: "useful",
        ifExpressions: false,
        earlyReturn: false,
        interpolatedStrings: false,
        mathConstants: false,
      },
    );
    const source = printLuau(ast);
    expect(source).toMatch(/function\(player: Player\)/);
    expect(source).toMatch(/return player/);
  });

  it("drops a dead local function after lifting function module.X", () => {
    const ast = cleanupAst(
      chunk([
        {
          kind: "local",
          names: ["ControlFlow"],
          values: [
            {
              kind: "function-expr",
              params: ["seed"],
              isVararg: false,
              body: { kind: "block", statements: [{ kind: "return", values: [ident("seed")] }] },
            },
          ],
        },
        {
          kind: "function-decl",
          local: false,
          name: "module.ControlFlow",
          params: ["seed"],
          isVararg: false,
          body: { kind: "block", statements: [{ kind: "return", values: [ident("seed")] }] },
        },
      ]),
      {
        typeAnnotations: "off",
        ifExpressions: false,
        earlyReturn: false,
        interpolatedStrings: false,
        mathConstants: false,
      },
    );
    const source = printLuau(ast);
    expect(source).toContain("function module.ControlFlow(seed)");
    expect(source).not.toMatch(/local function ControlFlow/);
    expect((source.match(/return seed/g) ?? []).length).toBe(1);
  });

  it("lifts a pure module alias into function module.X", () => {
    const ast = cleanupAst(
      chunk([
        { kind: "local", names: ["BuildMegaTable"], values: [] },
        {
          kind: "assign",
          targets: [ident("BuildMegaTable")],
          values: [
            {
              kind: "function-expr",
              params: ["seed"],
              isVararg: false,
              body: { kind: "block", statements: [{ kind: "return", values: [ident("seed")] }] },
            },
          ],
        },
        {
          kind: "assign",
          targets: [{ kind: "property", object: ident("module"), name: "BuildMegaTable" }],
          values: [ident("BuildMegaTable")],
        },
      ]),
      {
        typeAnnotations: "off",
        ifExpressions: false,
        earlyReturn: false,
        interpolatedStrings: false,
        mathConstants: false,
      },
    );
    const source = printLuau(ast);
    expect(source).toContain("function module.BuildMegaTable(seed)");
    expect(source).not.toMatch(/local BuildMegaTable/);
    expect(source).not.toMatch(/module\.BuildMegaTable = BuildMegaTable/);
  });

  it("folds identifier and property updates into compound assignments", () => {
    const ast = cleanupAst(
      chunk([
        { kind: "assign", targets: [ident("total")], values: [{ kind: "binary", op: "+", left: ident("total"), right: lit(1) }] },
        {
          kind: "assign",
          targets: [{ kind: "property", object: ident("self"), name: "value" }],
          values: [{ kind: "binary", op: "*", left: { kind: "property", object: ident("self"), name: "value" }, right: ident("amount") }],
        },
        {
          kind: "assign",
          targets: [{ kind: "index", table: ident("items"), key: ident("i") }],
          values: [{ kind: "binary", op: "+", left: { kind: "index", table: ident("items"), key: ident("i") }, right: lit(1) }],
        },
      ]),
      {
        typeAnnotations: "off",
        ifExpressions: false,
        earlyReturn: false,
        interpolatedStrings: false,
        mathConstants: false,
      },
    );
    const source = printLuau(ast);
    expect(source).toContain("total += 1");
    expect(source).toContain("self.value *= amount");
    // Indexed writes re-evaluate the key; keep the long form.
    expect(source).toContain("items[i] = items[i] + 1");
    expect(source).not.toContain("items[i] +=");
  });

  it("stays deterministic with the new cleanup pipeline", () => {
    const bytecode = compile(
      proto({
        constants: [...strings("print", "hello"), importConst(["print"])],
        instructions: [ad(Opcode.GETIMPORT, 0, 2), 0x40000000, ad(Opcode.LOADK, 1, 1), abc(Opcode.CALL, 0, 2, 1), ret()],
      }),
    );
    const first = decompile(bytecode);
    const second = decompile(bytecode);
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.source).toBe(second.source);
      expect(first.source).not.toContain("--");
    }
  });
});
