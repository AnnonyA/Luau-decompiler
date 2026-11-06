import { describe, expect, it } from "vitest";
import { block, chunk, ident, lit, type Expression, type Statement } from "../src/ast/Ast.ts";
import { inferHumanNames, repairUndeclaredAutoLocals } from "../src/reconstruct/NameInference.ts";
import { analyzeBindings } from "../src/analysis/Bindings.ts";
import { printLuau } from "../src/print/LuauPrinter.ts";

const call = (name: string, args: Expression[] = []): Expression => ({
  kind: "call", callee: ident(name), args, open: false,
});
const store = (value: Expression): Statement => ({
  kind: "assign", targets: [ident("value")], values: [value],
});
const reader: Statement = {
  kind: "function-decl", local: true, name: "read", params: [], isVararg: false,
  body: block([{ kind: "return", values: [ident("value")] }]),
};
const source = (statements: Statement[]): string => printLuau(inferHumanNames(chunk(statements)));

describe("cleanup respects lexical cells and observation points", () => {
  it("retains a store observed by a closure returned before the next overwrite", () => {
    const output = source([
      { kind: "local", names: ["value"], values: [lit(0)] },
      reader,
      store(lit(1)),
      { kind: "if", test: ident("flag"), branches: [],
        consequent: block([{ kind: "return", values: [ident("read")] }]) },
      store(lit(9)),
      { kind: "return", values: [ident("read")] },
    ]);
    expect(output).toContain("= 1");
    expect(output.indexOf("= 1")).toBeLessThan(output.indexOf("if flag"));
    expect(output).toContain("= 9");
  });

  it.each([false, true])("retains callback-visible stores in a nested block: %s", (nested) => {
    const updates: Statement[] = [
      store(lit(3)),
      { kind: "expression-stmt", expression: call("observe", [ident("read")]) },
      store(lit(7)),
    ];
    const output = source([
      { kind: "local", names: ["value"], values: [lit(0)] },
      reader,
      ...(nested ? [{ kind: "do", body: block(updates) } satisfies Statement] : updates),
      { kind: "return", values: [call("read")] },
    ]);
    expect(output).toContain("= 3");
    expect(output.indexOf("= 3")).toBeLessThan(output.indexOf("observe(read)"));
    expect(output.indexOf("observe(read)")).toBeLessThan(output.indexOf("= 7"));
  });

  it("retains a store read by a callback in the overwriting initializer", () => {
    const output = source([
      { kind: "local", names: ["value"], values: [lit(0)] },
      reader,
      store(lit(3)),
      store(call("read")),
      { kind: "return", values: [ident("value")] },
    ]);
    expect(output).toContain("= 3");
    expect(output.indexOf("= 3")).toBeLessThan(output.indexOf("= read()"));
  });

  it("retains a captured callee store observed during the subsequent call", () => {
    const output = source([
      { kind: "local", names: ["value"], values: [lit(0)] },
      reader,
      store(ident("read")),
      store(call("value")),
      { kind: "return", values: [ident("value")] },
    ]);
    expect(output).toMatch(/= read\n/);
    expect(output).not.toContain("= read()");
  });

  it("keeps a call argument bound to the initialized local", () => {
    const output = source([
      { kind: "local", names: ["value"], values: [ident("callable")] },
      store(call("value", [ident("value")])),
      { kind: "return", values: [ident("value")] },
    ]);
    expect(output).toMatch(/local (\w+) = callable\n\1 = \1\(\1\)/);
  });

  it("keeps a method argument bound to the initialized receiver", () => {
    const output = source([
      { kind: "local", names: ["value"], values: [ident("object")] },
      store({ kind: "method-call", object: ident("value"), name: "check", args: [ident("value")], open: false }),
      { kind: "return", values: [ident("value")] },
    ]);
    expect(output).toMatch(/local (\w+) = object\n\1 = \1:check\(\1\)/);
  });

  it("still folds an uncaptured callee with independent arguments", () => {
    const output = source([
      { kind: "local", names: ["value"], values: [ident("callable")] },
      store(call("value", [lit(5)])),
      { kind: "return", values: [ident("value")] },
    ]);
    expect(output).toMatch(/local \w+ = callable\(5\)/);
  });

  it("keeps distinct lexical declarations and observable global writes", () => {
    const output = source([
      store(lit(11)),
      store(lit(13)),
      { kind: "local", names: ["value"], values: [lit(17)] },
      { kind: "local", names: ["value"], values: [lit(19)] },
      { kind: "return", values: [ident("value")] },
    ]);
    for (const value of [11, 13, 17, 19]) expect(output).toContain(`= ${value}`);
  });

  it.each<Statement>([
    { kind: "expression-stmt", expression: call("effect") },
    { kind: "if", test: ident("flag"), branches: [],
      consequent: block([{ kind: "return", values: [] }]) },
  ])("does not scan across $kind observation points", (boundary) => {
    const output = source([
      { kind: "local", names: ["value"], values: [lit(23)] },
      boundary,
      store(lit(29)),
      { kind: "return", values: [ident("value")] },
    ]);
    expect(output).toContain("= 23");
    expect(output).toContain("= 29");
  });

  it("still removes an unused literal before an unconditional local overwrite", () => {
    const output = source([
      { kind: "local", names: ["value"], values: [lit(31)] },
      { kind: "local", names: ["other"], values: [lit(37)] },
      store(lit(41)),
      { kind: "return", values: [ident("value"), ident("other")] },
    ]);
    expect(output).not.toContain("= 31");
    expect(output).toContain("= 41");
    expect(output).toContain("= 37");
  });
});

describe("coalescing rewrites resolved cells in every AST container", () => {
  it("keeps closure assignments inside do blocks paired with their uses", () => {
    const closure = (value: number): Expression => ({kind: "function-expr", params: [], isVararg: false,
      body: block([{kind: "return", values: [lit(value)]}])});
    const output = inferHumanNames(chunk([
      {kind: "local", names: ["function_1"], values: []},
      {kind: "do", body: block([{kind: "assign", targets: [ident("function_1")], values: [closure(11)]}])},
      {kind: "expression-stmt", expression: call("observe", [call("function_1")])},
      {kind: "local", names: ["function_2"], values: []},
      {kind: "do", body: block([{kind: "assign", targets: [ident("function_2")], values: [closure(29)]}])},
      {kind: "return", values: [call("function_2")]},
    ]));
    const {bindings, globals} = analyzeBindings(output.body);
    expect(globals.has("function_2")).toBe(false);
    const returnStmt = output.body.statements.at(-1)!;
    const returned = bindings.find(binding => binding.reads.some(read => read.statement === returnStmt));
    expect(returned?.writes).toHaveLength(2);
    expect(returned!.writes[1]!.statement.kind).toBe("assign");
  });

  it("rewrites interpolation references to the same binding as their writes", () => {
    const output = inferHumanNames(chunk([
      {kind: "local", names: ["result1"], values: [lit(0)]},
      {kind: "expression-stmt", expression: call("observe", [ident("result1")])},
      {kind: "local", names: ["result2"], values: [lit(0)]},
      {kind: "compound-assign", target: ident("result2"), op: "+", value: lit(7)},
      {kind: "return", values: [{kind: "interp", parts: [{kind: "expr", value: ident("result2")}]}]},
    ]));
    expect(analyzeBindings(output.body).globals.has("result2")).toBe(false);
    expect(printLuau(output)).not.toContain("result2");
  });
});

describe("repair inside anonymous closures", () => {
  it("keeps parameter and enclosing cells while declaring only missing temporaries", () => {
    const ast = repairUndeclaredAutoLocals(chunk([
      {kind: "local", names: ["value"], values: [lit(1)]},
      {kind: "return", values: [{kind: "function-expr", params: ["result1"], isVararg: false,
        body: block([
          store(lit(2)),
          {kind: "assign", targets: [ident("result1")], values: [lit(3)]},
          {kind: "assign", targets: [ident("result2")], values: [lit(4)]},
          {kind: "return", values: [ident("value"), ident("result1"), ident("result2")]},
        ])}]},
    ]));
    const bindings = analyzeBindings(ast.body).bindings;
    expect(bindings.find(b => b.name === "value")?.captured).toBe(true);
    expect(bindings.find(b => b.name === "value")?.writes).toHaveLength(1);
    expect(bindings.find(b => b.name === "result1")?.declaration.kind).toBe("function-expr");
    expect(bindings.find(b => b.name === "result2")?.declaration.kind).toBe("local");
  });

  it("does not cross a constructor whose computed key can throw or observe state", () => {
    for (const key of [lit(null), lit(NaN), call("observe")]) {
      const output = source([
        {kind: "local", names: ["value"], values: [lit(23)]},
        {kind: "local", names: ["other"], values: [{kind: "table", fields: [{key, value: lit(1)}]}]},
        store(lit(29)),
        {kind: "return", values: [ident("value")]},
      ]);
      expect(output).toContain("= 23");
      expect(output).toContain("= 29");
    }
  });
});
