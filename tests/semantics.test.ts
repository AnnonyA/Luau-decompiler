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

  it("types InputBegan callbacks as InputObject + boolean", () => {
    const ast = cleanupAst(
      chunk([
        {
          kind: "expression-stmt",
          expression: {
            kind: "method-call",
            object: { kind: "property", object: ident("UserInputService"), name: "InputBegan" },
            name: "Connect",
            args: [
              {
                kind: "function-expr",
                params: ["value", "index"],
                isVararg: false,
                body: {
                  kind: "block",
                  statements: [
                    {
                      kind: "if",
                      test: ident("index"),
                      consequent: { kind: "block", statements: [{ kind: "return", values: [] }] },
                      branches: [],
                    },
                    {
                      kind: "expression-stmt",
                      expression: {
                        kind: "call",
                        callee: ident("print"),
                        args: [ident("value")],
                        open: false,
                      },
                    },
                  ],
                },
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
    expect(source).toMatch(/function\(input: InputObject, gameProcessedEvent: boolean\)/);
    expect(source).toMatch(/if gameProcessedEvent then/);
    expect(source).toMatch(/print\(input\)/);
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

  it("flattens a nested else/if return chain into elseif", () => {
    const ast = cleanupAst(
      chunk([
        {
          kind: "if",
          test: ident("a"),
          consequent: { kind: "block", statements: [{ kind: "return", values: [lit("legendary")] }] },
          branches: [],
          alternate: {
            kind: "block",
            statements: [
              {
                kind: "if",
                test: ident("b"),
                consequent: { kind: "block", statements: [{ kind: "return", values: [lit("epic")] }] },
                branches: [],
                alternate: {
                  kind: "block",
                  statements: [
                    {
                      kind: "if",
                      test: ident("c"),
                      consequent: { kind: "block", statements: [{ kind: "return", values: [lit("rare")] }] },
                      branches: [],
                      alternate: { kind: "block", statements: [{ kind: "return", values: [lit("common")] }] },
                    },
                  ],
                },
              },
            ],
          },
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
    expect(source).toMatch(/elseif b then/);
    expect(source).toMatch(/elseif c then/);
    expect(source).not.toMatch(/else\n    if b then/);
  });

  it("turns if/else returns into a return if-expression", () => {
    const ast = cleanupAst(
      chunk([
        {
          kind: "if",
          test: ident("flag"),
          consequent: { kind: "block", statements: [{ kind: "return", values: [ident("left")] }] },
          branches: [],
          alternate: { kind: "block", statements: [{ kind: "return", values: [ident("right")] }] },
        },
      ]),
      {
        typeAnnotations: "off",
        ifExpressions: true,
        earlyReturn: false,
        interpolatedStrings: false,
        mathConstants: false,
      },
    );
    expect(printLuau(ast)).toContain("return if flag then left else right");
  });

  it("turns a wrapping loop if into a continue guard", () => {
    const ast = cleanupAst(
      chunk([
        {
          kind: "numeric-for",
          name: "i",
          start: lit(1),
          stop: ident("n"),
          body: {
            kind: "block",
            statements: [
              {
                kind: "if",
                test: { kind: "binary", op: "~=", left: ident("i"), right: lit(0) },
                consequent: {
                  kind: "block",
                  statements: [
                    { kind: "assign", targets: [ident("total")], values: [{ kind: "binary", op: "+", left: ident("total"), right: ident("i") }] },
                    { kind: "expression-stmt", expression: { kind: "call", callee: ident("use"), args: [ident("i")], open: false } },
                  ],
                },
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
    expect(source).toMatch(/if i == 0 then\n\s+continue/);
    expect(source).toMatch(/total \+= i/);
  });

  it("splits an exiting elseif chain into sequential guards", () => {
    const ast = cleanupAst(
      chunk([
        {
          kind: "while",
          test: ident("run"),
          body: {
            kind: "block",
            statements: [
              {
                kind: "if",
                test: ident("stop"),
                consequent: { kind: "block", statements: [{ kind: "continue" }] },
                branches: [{ test: ident("ready"), body: { kind: "block", statements: [{ kind: "assign", targets: [ident("state")], values: [lit("go")] }] } }],
                alternate: { kind: "block", statements: [{ kind: "assign", targets: [ident("state")], values: [lit("idle")] }] },
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
    expect(source).toMatch(/if stop then\n\s+continue\n\s+end\n\s+if ready then/);
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

  it("renames the returned module from runtime context", () => {
    const bytecode = compile(
      proto({
        constants: strings("Enabled"),
        instructions: [
          abc(Opcode.NEWTABLE, 0, 0, 0),
          0,
          abc(Opcode.LOADB, 1, 1, 0),
          abc(Opcode.SETTABLEKS, 1, 0, 0),
          0,
          abc(Opcode.RETURN, 0, 2, 0),
        ],
        locals: [{ name: "module", startPc: 1, endPc: 6, register: 0 }],
      }),
    );
    const result = decompile(bytecode, { runtimeContext: { moduleName: "AdditionModule" } });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.source).toMatch(/local AdditionModule/);
      expect(result.source).not.toMatch(/\bmodule\b/);
    }
    const disabled = decompile(bytecode, { runtimeContext: false });
    expect(disabled.ok).toBe(true);
    if (disabled.ok) {
      expect(disabled.source).toMatch(/local (module|config)/);
    }
  });

  it("names Players.LocalPlayer as LocalPlayer, not player", () => {
    const ast = cleanupAst(
      chunk([{ kind: "local", names: ["player"], values: [{ kind: "property", object: ident("Players"), name: "LocalPlayer" }] }]),
      { typeAnnotations: "off", ifExpressions: false, earlyReturn: false, interpolatedStrings: false, mathConstants: false },
    );
    expect(printLuau(ast)).toMatch(/local LocalPlayer = Players\.LocalPlayer/);
  });

  it("names a makePayload result and inlines a one-use table local", () => {
    const ast = cleanupAst(
      chunk([
        { kind: "local", names: ["config"], values: [{ kind: "table", fields: [{ name: "zero", value: lit(0) }] }] },
        {
          kind: "local",
          names: ["config2"],
          values: [{ kind: "table", fields: [{ name: "Numbers", value: ident("config") }, { name: "Name", value: lit("Mega") }] }],
        },
        { kind: "local", names: ["value2"], values: [{ kind: "call", callee: ident("makePayload"), args: [ident("seed")], open: false }] },
        { kind: "assign", targets: [{ kind: "property", object: ident("module"), name: "Config" }], values: [ident("config2")] },
      ]),
      { typeAnnotations: "off", ifExpressions: false, earlyReturn: false, interpolatedStrings: false, mathConstants: false },
    );
    const source = printLuau(ast);
    expect(source).toMatch(/local payload = makePayload\(seed\)/);
    expect(source).toMatch(/Numbers = \{\s*zero = 0/);
    expect(source).not.toMatch(/local config\b/);
    expect(source).toMatch(/module\.Config = \{/);
  });

  it("turns an undeclared generated assign into a local", () => {
    const ast = cleanupAst(chunk([{ kind: "assign", targets: [ident("result27")], values: [ident("math")] }]), {
      typeAnnotations: "off",
      ifExpressions: false,
      earlyReturn: false,
      interpolatedStrings: false,
      mathConstants: false,
    });
    expect(printLuau(ast)).toMatch(/local result27 = math/);
  });

  it("names rgb formals from Color3.fromRGB", () => {
    const ast = cleanupAst(
      chunk([
        {
          kind: "function-decl",
          local: true,
          name: "rgb",
          params: ["value4", "index", "count"],
          isVararg: false,
          body: {
            kind: "block",
            statements: [
              {
                kind: "return",
                values: [
                  {
                    kind: "method-call",
                    object: ident("Color3"),
                    name: "fromRGB",
                    args: [ident("value4"), ident("index"), ident("count")],
                    open: false,
                  },
                ],
              },
            ],
          },
        },
      ]),
      { typeAnnotations: "off", ifExpressions: false, earlyReturn: false, interpolatedStrings: false, mathConstants: false },
    );
    expect(printLuau(ast)).toMatch(/function rgb\(r, g, b\)/);
  });

  it("folds x = math.clamp; x = x(n, 0, 20) and drops overwritten scratch", () => {
    const ast = cleanupAst(
      chunk([
        { kind: "assign", targets: [ident("result27")], values: [{ kind: "property", object: ident("math"), name: "clamp" }] },
        {
          kind: "assign",
          targets: [ident("result27")],
          values: [{ kind: "call", callee: ident("result27"), args: [ident("seed"), lit(0), lit(20)], open: false }],
        },
        { kind: "assign", targets: [ident("result27")], values: [ident("seed")] },
        { kind: "return", values: [ident("result27")] },
      ]),
      { typeAnnotations: "off", ifExpressions: false, earlyReturn: false, interpolatedStrings: false, mathConstants: false },
    );
    const source = printLuau(ast);
    expect(source).toMatch(/result27 = seed/);
    expect(source).toMatch(/return result27/);
    expect(source).not.toMatch(/math\.clamp/);
  });

  it("folds callee aliases inside assigned function expressions", () => {
    const ast = cleanupAst(
      chunk([
        {
          kind: "assign",
          targets: [ident("makePayload")],
          values: [
            {
              kind: "function-expr",
              params: ["id"],
              isVararg: false,
              body: {
                kind: "block",
                statements: [
                  { kind: "assign", targets: [ident("result19")], values: [{ kind: "property", object: ident("math"), name: "abs" }] },
                  {
                    kind: "assign",
                    targets: [ident("result19")],
                    values: [{ kind: "call", callee: ident("result19"), args: [ident("id")], open: false }],
                  },
                  { kind: "return", values: [ident("result19")] },
                ],
              },
            },
          ],
        },
      ]),
      { typeAnnotations: "off", ifExpressions: false, earlyReturn: false, interpolatedStrings: false, mathConstants: false },
    );
    expect(printLuau(ast)).toMatch(/result19 = math\.abs\(id\)/);
    expect(printLuau(ast)).not.toMatch(/result19 = math\.abs\n/);
  });

  it("drops a generated assign overwritten after an unrelated local", () => {
    const ast = cleanupAst(
      chunk([
        { kind: "local", names: ["value117"], values: [lit(4)] },
        { kind: "local", names: ["config47"], values: [{ kind: "table", fields: [{ name: "name", value: lit("A") }] }] },
        { kind: "assign", targets: [ident("value117")], values: [ident("seed")] },
        { kind: "return", values: [ident("value117")] },
      ]),
      { typeAnnotations: "off", ifExpressions: false, earlyReturn: false, interpolatedStrings: false, mathConstants: false },
    );
    const source = printLuau(ast);
    expect(source).toMatch(/local value117 = seed/);
    expect(source).not.toMatch(/value117 = 4/);
    expect(source).toMatch(/config47/);
  });

  it("coalesces empty generated accumulators onto the first zero local", () => {
    const ast = cleanupAst(
      chunk([
        {
          kind: "function-decl",
          local: true,
          name: "loopStress",
          params: ["limit"],
          isVararg: false,
          body: {
            kind: "block",
            statements: [
              { kind: "local", names: ["result5"], values: [lit(0)] },
              {
                kind: "numeric-for",
                name: "i",
                start: lit(1),
                stop: ident("limit"),
                body: {
                  kind: "block",
                  statements: [
                    { kind: "local", names: ["result6"], values: [] },
                    { kind: "compound-assign", target: ident("result6"), op: "+", value: ident("i") },
                  ],
                },
              },
              { kind: "local", names: ["result8"], values: [] },
              { kind: "compound-assign", target: ident("result8"), op: "+", value: lit(1) },
              { kind: "return", values: [ident("result8")] },
            ],
          },
        },
      ]),
      { typeAnnotations: "off", ifExpressions: false, earlyReturn: false, interpolatedStrings: false, mathConstants: false },
    );
    const source = printLuau(ast);
    // Coalesce first, then the returned accumulator is renamed to `total`.
    expect(source).toMatch(/local total = 0/);
    expect(source).toMatch(/total \+= i/);
    expect(source).toMatch(/total \+= 1/);
    expect(source).toMatch(/return total/);
    expect(source).not.toMatch(/result5|result6|result8/);
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
