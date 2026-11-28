import {expect, it} from "vitest";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {block, chunk, ident, lit, type Expression, type Statement} from "../src/ast/Ast.ts";
import {refineStructure} from "../src/ast/StructureRefinement.ts";
import {decompile} from "../src/decompile.ts";
import {printLuau} from "../src/print/LuauPrinter.ts";

const local = (value: Expression): Statement => ({kind: "local", names: ["result"], values: [value]});
const assign = (value: Expression): Statement => ({kind: "assign", targets: [ident("result")], values: [value]});
const call = (name = "produce"): Expression => ({kind: "call", callee: ident(name), args: [], open: false});
const compare = (op: "==" | "<" | "<=", left = call("left"), right = call("right")): Expression =>
  ({kind: "binary", op, left, right});
const guard = (test: Expression, value: Expression): Statement =>
  ({kind: "if", test, consequent: block([assign(value)]), branches: []});
const result = (statements: Statement[], ifExpressions = true) =>
  refineStructure(chunk(statements), {ifExpressions, guards: false});
const output = (statements: Statement[]) => printLuau(result(statements));

it("joins an inert default and one conditional store into a scalar value", () => {
  expect(output([local(lit(false)), guard(compare("=="), call())]))
    .toBe("local result = left() == right() and produce()\n");
  expect(output([local(lit(true)), guard(compare("=="), call())]))
    .toBe("local result = left() ~= right() or produce()\n");
});

it("preserves false defaults when an unknown test returns nil", () => {
  expect(output([local(lit(false)), guard(ident("input"), call())]))
    .toBe("local result = if input then produce() else false\n");
  expect(output([local(lit(null)), guard(ident("input"), call())]))
    .toBe("local result = if input then produce() else nil\n");
  expect(output([local(lit(17)), guard(ident("input"), call())]))
    .toBe("local result = if input then produce() else 17\n");
});

it("keeps NaN-sensitive comparison negation exact", () => {
  for (const op of ["<", "<="] as const) {
    const ast = result([local(lit(true)), guard(compare(op), call())]);
    expect(ast.body.statements[0]).toMatchObject({kind: "local", values: [
      {kind: "binary", op: "or", left: {kind: "unary", op: "not", argument: {kind: "binary", op}}},
    ]});
  }
});

it("retains initialization and writes to captured cells", () => {
  const captured: Expression = {kind: "function-expr", params: [], isVararg: false,
    body: block([{kind: "return", values: [ident("result")]}])};
  const ast = result([local(lit(false)), guard(compare("=="), call()),
    {kind: "local", names: ["observe"], values: [captured]}]);
  expect(ast.body.statements).toHaveLength(3);
  expect(ast.body.statements[1].kind).toBe("if");
});

it("keeps reads of the destination bound to the initialized local", () => {
  for (const [test, value] of [[ident("result"), call()], [call("test"), ident("result")],
    [compare("==", ident("result"), lit(false)), call()]] as [Expression, Expression][]) {
    const ast = result([local(lit(false)), guard(test, value)]);
    // The preexisting self-guard fold may still combine the first pattern.
    if (test.kind === "identifier") {
      expect(printLuau(ast)).toBe("local result = false and produce()\n");
    } else {
      expect(ast.body.statements).toHaveLength(2);
    }
  }
});

it("does not discard effectful defaults or move closure creation", () => {
  const closure: Expression = {kind: "function-expr", params: [], isVararg: false, body: block([])};
  for (const initial of [call("initialize"), ident("default"), {kind: "table", fields: []}] as Expression[])
    expect(result([local(initial), guard(compare("=="), call())]).body.statements).toHaveLength(2);
  expect(result([local(lit(null)), guard(compare("=="), closure)]).body.statements).toHaveLength(2);
  const withClosure: Expression = {kind: "table", fields: [{name: "callback", value: closure}]};
  expect(result([local(lit(null)), guard(compare("=="), withClosure)]).body.statements).toHaveLength(2);
});

it("requires a single private declaration and one guarded scalar assignment", () => {
  const sequence = [local(lit(false)), guard(compare("=="), call())];
  expect(result(sequence, false).body.statements).toHaveLength(2);
  expect(result([assign(lit(false)), sequence[1]!]).body.statements).toHaveLength(2);
  expect(result([{kind: "local", names: ["result", "other"], values: [lit(false)]}, sequence[1]!]).body.statements).toHaveLength(2);
  expect(result([sequence[0]!, guard(compare("=="), {kind: "vararg"})]).body.statements).toHaveLength(2);
  const branches = guard(compare("=="), call()) as Extract<Statement, {kind: "if"}>;
  branches.consequent.statements.unshift({kind: "expression-stmt", expression: call("effect")});
  expect(result([sequence[0]!, branches]).body.statements).toHaveLength(2);
});

const fixture = (name: string) => readFileSync(new URL(`./fixtures/guarded-literal-selects/${name}`, import.meta.url));
const manifest = JSON.parse(fixture("manifest.json").toString()) as {
  sources: Array<{path: string; sha256: string}>;
  inputs: Array<{path: string; sha256: string; pin: string; profile: string}>;
};
it("pins the independently authored sources and both official compiler matrices", () => {
  expect(manifest.inputs).toHaveLength(24);
  for (const source of manifest.sources)
    expect(createHash("sha256").update(fixture(source.path)).digest("hex")).toBe(source.sha256);
  for (const input of manifest.inputs) {
    const bytes = fixture(input.path);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(input.sha256);
    const reconstructed = decompile(bytes, {opcodeEncoding: "official"});
    if (!reconstructed.ok) throw new Error(reconstructed.error);
    expect(reconstructed.validation).toEqual([]);
  }
});
