import {expect, it} from "vitest";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {block, chunk, ident, lit, type Expression} from "../src/ast/Ast.ts";
import {refineStructure} from "../src/ast/StructureRefinement.ts";
import {printLuau} from "../src/print/LuauPrinter.ts";
import {decompile} from "../src/decompile.ts";

const call = (name = "produce"): Expression => ({kind: "call", callee: ident(name), args: [], open: false});
const select = (test: Expression, consequent: Expression, alternate: Expression): Expression =>
  ({kind: "if-expr", test, consequent, branches: [], alternate});
const compare = (op: "==" | "~=" | "<" | "<="): Expression =>
  ({kind: "binary", op, left: call("first"), right: call("second")});
function refined(value: Expression): Expression {
  const result = refineStructure(chunk([{kind: "return", values: [value]}]), {guards: true, ifExpressions: true});
  const statement = result.body.statements[0]!;
  if (statement.kind !== "return") throw new Error("expected a return");
  return statement.values[0]!;
}
const source = (value: Expression) => printLuau(chunk([{kind: "return", values: [refined(value)]}]));

it("recovers boolean comparison selects without repeating their operands", () => {
  expect(source(select(compare("=="), call(), lit(false))))
    .toBe("return first() == second() and produce()\n");
  expect(source(select(compare("=="), lit(true), call())))
    .toBe("return first() == second() or produce()\n");
});

it("retains unknown test values whose nil or non-boolean value is not the selected boolean", () => {
  for (const test of [ident("input"), call("input"), {kind: "property", object: ident("data"), name: "value"}] as Expression[]) {
    expect(refined(select(test, call(), lit(false))).kind).toBe("if-expr");
    expect(refined(select(test, lit(true), call())).kind).toBe("if-expr");
  }
});

it("retains arbitrary truthiness selects and negates boolean comparisons exactly", () => {
  expect(refined(select(call("input"), lit(false), call())).kind).toBe("if-expr");
  expect(refined(select(call("input"), call(), lit(true))).kind).toBe("if-expr");
  expect(source(select(compare("=="), lit(false), call())))
    .toBe("return first() ~= second() and produce()\n");
  expect(source(select(compare("=="), call(), lit(true))))
    .toBe("return first() ~= second() or produce()\n");
});

it("keeps the negation of NaN-sensitive ordering comparisons", () => {
  for (const op of ["<", "<="] as const) {
    const value = refined(select(compare(op), lit(false), call()));
    expect(value).toMatchObject({kind: "binary", op: "and", left: {kind: "unary", op: "not", argument: {kind: "binary", op}}});
  }
});

it("requires both short-circuit inputs to be boolean in a value-level proof", () => {
  const test: Expression = {kind: "binary", op: "or", left: compare("=="), right: compare("~=")};
  expect(refined(select(test, call(), lit(false)))).toMatchObject({kind: "binary", op: "and"});
  expect(refined(select({...test, right: ident("fallback")}, call(), lit(false))).kind).toBe("if-expr");
});

it("retains closure literal naming and creation forms and does not merge an elseif select", () => {
  const fn: Expression = {kind: "function-expr", params: [], isVararg: false,
    body: block([{kind: "return", values: [lit(7)]}])};
  expect(refined(select(compare("=="), fn, lit(false))).kind).toBe("if-expr");
  const value = select(compare("=="), call(), lit(false));
  if (value.kind !== "if-expr") throw new Error("expected a select");
  value.branches.push({test: call("other"), value: lit(5)});
  expect(refined(value).kind).toBe("if-expr");
});

const fixture = (name: string) => readFileSync(new URL(`./fixtures/boolean-selects/${name}`, import.meta.url));
for (const file of ["manifest.json", "prefix-manifest.json"]) {
  const manifest = JSON.parse(fixture(file).toString()) as {
    source: string; sourceSha256: string; entries: Array<{profile: string; bytecode: string; sha256: string}>;
  };
  for (const entry of manifest.entries) {
    it(`keeps the sealed ${manifest.source} control valid at ${entry.profile}`, () => {
      expect(createHash("sha256").update(fixture(manifest.source)).digest("hex")).toBe(manifest.sourceSha256);
      const bytes = fixture(entry.bytecode);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(entry.sha256);
      const result = decompile(bytes, {opcodeEncoding: "official"});
      if (!result.ok) throw new Error(result.error);
      expect(result.validation).toEqual([]);
    });
  }
}
