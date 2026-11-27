import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {expect, it} from "vitest";
import {analyzeBindings} from "../src/analysis/Bindings.ts";
import {block, chunk, ident, lit, type Expression, type Statement} from "../src/ast/Ast.ts";
import {refineStructure} from "../src/ast/StructureRefinement.ts";
import {decompile} from "../src/decompile.ts";
import {printLuau} from "../src/print/LuauPrinter.ts";

const call = (name: string): Expression => ({kind: "call", callee: ident(name), args: [], open: false});
const ret = (...values: Expression[]): Statement => ({kind: "return", values});
const guard = (test: Expression, ...statements: Statement[]): Statement =>
  ({kind: "if", test, consequent: block(statements), branches: []});
const refine = (statements: Statement[]) => refineStructure(chunk(statements), {ifExpressions: true, guards: true});
const truthy = (value: unknown) => value !== null && value !== false;

/** Independent small executor for the terminal subset used by these controls.
 * Calls carry tuples; only a final ungrouped call/vararg expands its tuple. */
function execute(statements: Statement[], initial: Record<string, any>): unknown[] | undefined {
  const scalar = (value: Expression, env: Record<string, any>): any => {
    switch (value.kind) {
      case "literal": return value.value;
      case "identifier": return env[value.name];
      case "call": return env[(value.callee as any).name]()[0] ?? null;
      case "paren": return scalar(value.expression, env);
      case "vararg": return env.args[0] ?? null;
      case "unary": return !truthy(scalar(value.argument, env));
      case "binary": {
        const left = scalar(value.left, env);
        if (value.op === "and") return truthy(left) ? scalar(value.right, env) : left;
        if (value.op === "or") return truthy(left) ? left : scalar(value.right, env);
        const right = scalar(value.right, env);
        if (value.op === "==") return left === right;
        if (value.op === "~=") return left !== right;
        if (value.op === "<") return left < right;
        if (value.op === "<=") return left <= right;
        if (value.op === ">") return left > right;
        if (value.op === ">=") return left >= right;
        throw new Error(`unsupported binary ${value.op}`);
      }
      case "if-expr": {
        if (truthy(scalar(value.test, env))) return scalar(value.consequent, env);
        for (const branch of value.branches) if (truthy(scalar(branch.test, env))) return scalar(branch.value, env);
        return scalar(value.alternate, env);
      }
      default: throw new Error(`unsupported expression ${value.kind}`);
    }
  };
  const run = (body: Statement[], env: Record<string, any>): unknown[] | undefined => {
    for (const statement of body) {
      if (statement.kind === "return") return statement.values.flatMap((value, index) => {
        if (index + 1 === statement.values.length) {
          if (value.kind === "call") return env[(value.callee as any).name]();
          if (value.kind === "vararg") return env.args;
        }
        return [scalar(value, env)];
      });
      if (statement.kind === "local") {
        const values = statement.values.map(value => scalar(value, env));
        statement.names.forEach((name, index) => {env[name] = values[index] ?? null;});
      } else if (statement.kind === "expression-stmt") {
        scalar(statement.expression, env);
      } else if (statement.kind === "if") {
        const selected = truthy(scalar(statement.test, env)) ? statement.consequent :
          statement.branches.find(branch => truthy(scalar(branch.test, env)))?.body ?? statement.alternate;
        if (selected) {
          const result = run(selected.statements, Object.create(env));
          if (result !== undefined) return result;
        }
      } else {
        throw new Error(`unsupported statement ${statement.kind}`);
      }
    }
  };
  return run(statements, {...initial});
}

it("merges equal return guards with exact truthiness, evaluation order and tuple arity", () => {
  const token = {};
  const exit = ret(lit("chosen"), lit(null), ident("token"));
  const original = [guard(call("first"), exit), guard(call("second"), exit), ret(lit("tail"))];
  const result = refine(original);
  expect(result.body.statements).toHaveLength(2);
  for (const first of [false, null, true, 0, "", token]) for (const second of [false, null, true, 0, "", token]) {
    const run = (statements: Statement[]) => {
      const trace: string[] = [];
      const values = execute(statements, {token, first: () => {trace.push("first"); return [first, "extra"];},
        second: () => {trace.push("second"); return [second, null, "extra"];}});
      return {values, trace};
    };
    expect(run(result.body.statements)).toEqual(run(original));
  }
});

it("does not merge returned closure creation sites or non-terminal branch work", () => {
  const fn: Expression = {kind: "function-expr", params: [], isVararg: false, body: block([ret(lit(7))])};
  expect(refine([guard(ident("a"), ret(fn)), guard(ident("b"), ret(structuredClone(fn)))]).body.statements).toHaveLength(2);
  const work: Statement = {kind: "expression-stmt", expression: call("work")};
  expect(refine([guard(ident("a"), work), guard(ident("b"), work)]).body.statements).toHaveLength(2);
  expect(refine([guard(ident("a"), ret(lit(1))), work, guard(ident("b"), ret(lit(1)))]).body.statements).toHaveLength(3);
});

it("keeps distinct return actions and limits a merged condition's size", () => {
  const different = refine([guard(ident("a"), ret(lit(1))), guard(ident("b"), ret(lit(2)))]);
  expect(different.body.statements).toHaveLength(2);
  const many = refine(Array.from({length: 8}, (_, index) => guard(ident(`condition${index}`), ret(lit(1)))));
  expect(many.body.statements).toHaveLength(2);
});

it("rebuilds return ladders without changing open, scalar, zero-result or nil-containing packs", () => {
  const original = [
    guard(ident("a"), ret(call("many"))),
    guard(ident("b"), ret({kind: "paren", expression: call("none")})),
    guard(ident("c"), ret({kind: "vararg"})),
    ret(call("none")),
  ];
  const result = refine(original);
  expect(result.body.statements).toHaveLength(1);
  expect(result.body.statements[0]).toMatchObject({kind: "if", branches: [{test: ident("b")}, {test: ident("c")}],
    alternate: block([ret(call("none"))])});
  for (const selected of [0, 1, 2, 3]) {
    const initial = {a: selected === 0, b: selected === 1, c: selected === 2,
      many: () => [3, null, 5, null], none: () => [], args: [7, null, 9]};
    expect(execute(result.body.statements, initial)).toEqual(execute(original, initial));
  }
});

it("joins nested disjunctions with the outer test while preserving its position", () => {
  const original = [guard(call("outer"), guard(call("first"), ret(lit(1))), guard(call("second"), ret(lit(1)))), ret(lit(0))];
  const source = printLuau(refine(original));
  expect(source).toContain("if outer() and (first() or second()) then");
});

it("places a shorter terminal return first without capturing the former outer binding", () => {
  const original: Statement[] = [
    {kind: "local", names: ["value"], values: [lit("outer")]},
    guard({kind: "binary", op: "~=", left: ident("input"), right: lit(0)},
      {kind: "local", names: ["value"], values: [lit("inner")]}, ret(ident("value"))),
    ret(ident("value")),
  ];
  const result = refine(original);
  expect(printLuau(result)).toContain('if input == 0 then\n    return value\nend\nlocal value = "inner"');
  for (const input of [0, 1, Number.NaN]) expect(execute(result.body.statements, {input})).toEqual(execute(original, {input}));
});

it("does not introduce a negative guard or extend a local through a repeat condition", () => {
  const test: Expression = {kind: "binary", op: ">", left: ident("input"), right: lit(0)};
  const branch = guard(test, {kind: "local", names: ["value"], values: [lit(1)]}, ret(ident("value")));
  expect(printLuau(refine([branch, ret(lit(0))]))).toContain("if input > 0 then");
  const repeated = refine([{kind: "repeat", test: ident("value"), body: block([
    guard({kind: "binary", op: "~=", left: ident("input"), right: lit(0)},
      {kind: "local", names: ["value"], values: [lit(1)]}, ret(ident("value"))), ret(lit(0)),
  ])}]);
  expect(analyzeBindings(repeated.body).globals.has("value")).toBe(true);
});

it("simplifies equality complements but keeps NaN-sensitive ordering complements", () => {
  for (const op of ["==", "~=", "<", "<=", ">", ">="] as const) {
    const comparison: Expression = {kind: "binary", op, left: ident("a"), right: ident("b")};
    const original = [ret({kind: "unary", op: "not", argument: {kind: "paren", expression: comparison}})];
    const result = refine(original);
    for (const a of [Number.NaN, -1, 0, 1]) for (const b of [Number.NaN, -1, 0, 1]) {
      expect(execute(result.body.statements, {a, b})).toEqual(execute(original, {a, b}));
    }
    expect(printLuau(result).includes("not")).toBe(op !== "==" && op !== "~=");
  }
});

const fixture = (name: string) => readFileSync(new URL(`./fixtures/terminal-guards/${name}`, import.meta.url));
const manifest = JSON.parse(fixture("manifest.json").toString()) as {
  source: string; sourceSha256: string; entries: Array<{profile: string; bytecode: string; sha256: string}>;
};
for (const entry of manifest.entries) {
  it(`validates the sealed terminal guard, capture and pack control at ${entry.profile}`, () => {
    const bytes = fixture(entry.bytecode);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(entry.sha256);
    expect(createHash("sha256").update(fixture(manifest.source)).digest("hex")).toBe(manifest.sourceSha256);
    const result = decompile(bytes, {opcodeEncoding: "official"});
    if (!result.ok) throw new Error(result.error);
    expect(result.validation).toEqual([]);
    // The pinned O2 compiler replaces math.huge with its numeric constant.
    const globals = ["print", "select", "setmetatable", "table", "tostring"];
    if (!entry.profile.startsWith("O2")) globals.unshift("math");
    expect([...analyzeBindings(result.ast.body).globals].sort()).toEqual(globals);
  });
}
