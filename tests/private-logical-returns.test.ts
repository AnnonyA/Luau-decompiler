import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {expect, it} from "vitest";
import {analyzeBindings} from "../src/analysis/Bindings.ts";
import {block, chunk, ident, lit, type Expression, type Statement} from "../src/ast/Ast.ts";
import {cleanupAst} from "../src/ast/AstCleanup.ts";
import {recoverPrivateLogicalReturns} from "../src/ast/StructureRefinement.ts";
import {decompile, defaultCleanupOptions} from "../src/decompile.ts";
import {printLuau} from "../src/print/LuauPrinter.ts";

const ret = (value: Expression): Statement => ({kind: "return", values: [value]});
const local = (name: string, value: Expression): Statement => ({kind: "local", names: [name], values: [value]});
const assign = (value: Expression): Statement => ({kind: "assign", targets: [ident("result")], values: [value]});
const call = (name: string): Expression => ({kind: "call", callee: ident(name), args: [], open: false});
const guard = (test: Expression, statements: Statement[]): Statement => ({kind: "if", test, consequent: block(statements), branches: []});
const fn = (statements: Statement[], name = "enabled"): Statement => ({kind: "function-decl", local: true, name,
  params: ["first", "second"], isVararg: false, body: block(statements)});
function chain(input: Expression = ident("first"), next: Expression = ident("second"), alternative = false): Statement[] {
  const tested = (): Expression => alternative ? {kind: "unary", op: "not", argument: ident("result")} : ident("result");
  return [local("result", input), guard(tested(), [assign(next), guard(tested(), [
    guard(ident("flag"), [ret({kind: "property", object: ident("data"), name: "force"})]),
    assign(lit(true)), ret(ident("result")),
  ]), ret(ident("result"))]), ret(ident("result"))];
}
const truthy = (value: unknown) => value !== false && value !== null;
function evaluate(value: Expression, env: Record<string, any>): any {
  switch (value.kind) {
    case "literal": return value.value;
    case "identifier": return env[value.name];
    case "paren": return evaluate(value.expression, env);
    case "property": return evaluate(value.object, env)[value.name];
    case "call": return env[(value.callee as any).name]()[0] ?? null;
    case "unary": return !truthy(evaluate(value.argument, env));
    case "binary": {
      const left = evaluate(value.left, env);
      return value.op === "and" ? (truthy(left) ? evaluate(value.right, env) : left)
        : (truthy(left) ? left : evaluate(value.right, env));
    }
    case "if-expr": return evaluate(truthy(evaluate(value.test, env)) ? value.consequent : value.alternate, env);
    default: throw new Error(`unsupported expression ${value.kind}`);
  }
}

it.each([false, true])("retains exact selected values and property effects in a private logical chain (or: %s)", alternative => {
  const result = recoverPrivateLogicalReturns(chunk([fn(chain(undefined, undefined, alternative))]));
  const body = (result.body.statements[0] as Extract<Statement, {kind: "function-decl"}>).body.statements;
  expect(body).toHaveLength(1);
  expect(body[0].kind).toBe("return");
  const expression = (body[0] as Extract<Statement, {kind: "return"}>).values[0]!;
  const token = {}, callback = () => token;
  for (const first of [false, null, true, 0, "", token, callback]) {
    for (const second of [false, null, true, 0, "", token, callback]) {
      for (const flag of [false, true]) for (const forced of [false, null, token, callback]) {
        let reads = 0;
        const data = {get force() {reads += 1; return forced;}};
        const firstContinues = alternative ? !truthy(first) : truthy(first);
        const secondContinues = alternative ? !truthy(second) : truthy(second);
        const expected = !firstContinues ? first : !secondContinues ? second : flag ? forced : true;
        expect(evaluate(expression, {first, second, flag, data})).toBe(expected);
        expect(reads).toBe(firstContinues && secondContinues && flag ? 1 : 0);
      }
    }
  }
});

it("does not confuse an unrelated captured local with the same spelling", () => {
  const observer: Expression = {kind: "function-expr", params: [], isVararg: false, body: block([ret(ident("result"))])};
  const other = fn([local("result", lit(1)), ret(observer)], "other");
  const result = recoverPrivateLogicalReturns(chunk([other, fn(chain())]));
  expect(printLuau(result)).toContain("return first and second and (if flag then data.force else true)");
  expect(printLuau(result)).toContain("local result = 1");
});

it("retains ordinary locals, global reads and effectful or allocated intermediate values", () => {
  for (const value of [call("produce"), {kind: "table", fields: []}, ident("globalInput")] as Expression[]) {
    expect(printLuau(recoverPrivateLogicalReturns(chunk([fn(chain(value))])))).toContain("local result");
    expect(printLuau(recoverPrivateLogicalReturns(chunk([fn(chain(undefined, value))])))).toContain("local result");
  }
  const ordinary = fn([local("input", ident("first")), ...chain(ident("input"))]);
  expect(printLuau(recoverPrivateLogicalReturns(chunk([ordinary])))).toContain("local result");
  const overwritten = fn([{kind: "assign", targets: [ident("first")], values: [ident("second")]}, ...chain()]);
  expect(printLuau(recoverPrivateLogicalReturns(chunk([overwritten])))).toContain("local result");
});

it("retains captured inputs and residual reads of the result cell", () => {
  const capture: Expression = {kind: "function-expr", params: [], isVararg: false, body: block([ret(ident("first"))])};
  const observed = fn([local("reader", capture), ...chain()]);
  expect(printLuau(recoverPrivateLogicalReturns(chunk([observed])))).toContain("local result");
  const body = [local("result", ident("first")), guard(ident("result"), [
    ret({kind: "property", object: ident("result"), name: "force"}),
  ]), ret(ident("result"))];
  expect(printLuau(recoverPrivateLogicalReturns(chunk([fn(body)])))).toContain("local result");
});

it("keeps open return packs and closure creation sites outside the proof", () => {
  const closure: Expression = {kind: "function-expr", params: [], isVararg: false, body: block([ret(lit(7))])};
  for (const value of [call("many"), {kind: "vararg"}, closure] as Expression[]) {
    const body = [local("result", ident("first")), guard(ident("result"), [ret(value)]), ret(ident("result"))];
    const declaration = fn(body) as Extract<Statement, {kind: "function-decl"}>;
    declaration.isVararg = value.kind === "vararg";
    expect(printLuau(recoverPrivateLogicalReturns(chunk([declaration])))).toContain("local result");
  }
});

it("retains the one-result adjustment of an assigned final call including zero results", () => {
  const body = [local("result", ident("first")), guard(ident("result"), [assign(call("many")), ret(ident("result"))]), ret(ident("result"))];
  const result = recoverPrivateLogicalReturns(chunk([fn(body)]));
  const statements = (result.body.statements[0] as Extract<Statement, {kind: "function-decl"}>).body.statements;
  expect(statements).toHaveLength(1);
  const value = (statements[0] as Extract<Statement, {kind: "return"}>).values[0]!;
  for (const returned of [[], [null, 3], [5, null, 7]]) {
    let calls = 0;
    expect(evaluate(value, {first: true, many: () => {calls += 1; return returned;}})).toBe(returned[0] ?? null);
    expect(calls).toBe(1);
  }
});

it("respects the preference to keep conditional expressions disabled", () => {
  const result = cleanupAst(chunk([fn(chain())]), defaultCleanupOptions({ifExpressions: false}));
  expect(JSON.stringify(result)).not.toContain('"kind":"if-expr"');
  const body = (result.body.statements[0] as Extract<Statement, {kind: "function-decl"}>).body.statements;
  expect(body[0].kind).toBe("local");
  expect(body[1]).toMatchObject({kind: "if", test: ident((body[0] as Extract<Statement, {kind: "local"}>).names[0]!)});
});

const fixture = (name: string) => readFileSync(new URL(`./fixtures/private-logical-returns/${name}`, import.meta.url));
const manifest = JSON.parse(fixture("manifest.json").toString()) as {
  source: string; sourceSha256: string; entries: Array<{profile: string; bytecode: string; sha256: string}>;
};
for (const entry of manifest.entries) {
  it(`validates the sealed private-value, capture and arity control at ${entry.profile}`, () => {
    const bytes = fixture(entry.bytecode);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(entry.sha256);
    expect(createHash("sha256").update(fixture(manifest.source)).digest("hex")).toBe(manifest.sourceSha256);
    const result = decompile(bytes, {opcodeEncoding: "official"});
    if (!result.ok) throw new Error(result.error);
    expect(result.validation).toEqual([]);
    expect([...analyzeBindings(result.ast.body).globals].sort()).toEqual(["debug", "print", "select", "setmetatable", "table", "tostring"]);
  });
}
