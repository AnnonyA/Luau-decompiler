import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {expect, it} from "vitest";
import {analyzeBindings} from "../src/analysis/Bindings.ts";
import {block, chunk, ident, lit, type Expression, type Statement} from "../src/ast/Ast.ts";
import {refineStructure} from "../src/ast/StructureRefinement.ts";
import {printLuau} from "../src/print/LuauPrinter.ts";
import {decompile} from "../src/decompile.ts";

const call = (name: string): Expression => ({kind: "call", callee: ident(name), args: []});
const effect: Statement = {kind: "expression-stmt", expression: call("observe")};
const guard = (test: Expression): Statement => ({kind: "if", test,
  consequent: block([{kind: "break"}]), branches: []});
const refine = (statements: Statement[], test: Expression = lit(true)) => refineStructure(
  chunk([{kind: "while", test, body: block(statements)}]), {guards: true, ifExpressions: true});

it("joins consecutive entry guards in their original short-circuit order", () => {
  const output = printLuau(refine([guard(call("first")), guard(call("second")), effect]));
  expect(output).toBe("while not first() and not second() do\n    observe()\nend\n");
});

it("keeps explicit body exits when the loop already has an entry condition", () => {
  expect(printLuau(refine([guard(call("stop")), effect], call("ready"))))
    .toBe("while ready() do\n    if stop() then\n        break\n    end\n    observe()\nend\n");
});

it("does not lift a head guard across a local declaration or effect", () => {
  for (const first of [effect, {kind: "local", names: ["ready"], values: [call("read")]}] as Statement[]) {
    expect(refine([first, guard(ident("ready")), effect]).body.statements[0]).toMatchObject({kind: "while", test: lit(true)});
  }
});

it.each(["<", "<=", ">", ">="] as const)("preserves a NaN-sensitive %s head test", op => {
  const test: Expression = {kind: "binary", op, left: ident("left"), right: ident("right")};
  expect(refine([guard(test), effect]).body.statements[0]).toMatchObject({kind: "while",
    test: {kind: "unary", op: "not", argument: test}});
});

it("recovers a repeat latch without widening or losing its local binding", () => {
  const result = refine([{kind: "local", names: ["value"], values: [call("read")]},
    effect, guard({kind: "binary", op: "==", left: ident("value"), right: lit(null)}),
    guard({kind: "binary", op: "<", left: ident("value"), right: lit(0)})]);
  expect(result.body.statements[0]).toMatchObject({kind: "repeat", test: {kind: "binary", op: "or"}});
  expect(analyzeBindings(result.body).globals.has("value")).toBe(false);
  expect(printLuau(result)).toContain("until value == nil or value < 0");
});

it("does not evaluate a recovered latch after a continue that previously skipped it", () => {
  const skip: Statement = {kind: "if", test: call("skip"), consequent: block([{kind: "continue"}]), branches: []};
  const result = refine([effect, skip, effect, guard(call("stop"))]);
  expect(result.body.statements[0]).toMatchObject({kind: "while", test: lit(true)});
  expect(printLuau(result)).toContain("if stop() then");
});

it("ignores continues owned by a nested loop and preserves other exits", () => {
  const nested: Statement = {kind: "numeric-for", name: "index", start: lit(1), stop: lit(3), body: block([
    {kind: "if", test: call("skip"), consequent: block([{kind: "continue"}]), branches: []}, effect])};
  const result = refine([nested, guard(call("early")), effect, guard(call("stop"))]);
  expect(result.body.statements[0]).toMatchObject({kind: "repeat", test: call("stop")});
  expect(printLuau(result)).toContain("if early() then\n        break");
});

it("does not move a nontrivial terminating branch into a loop condition", () => {
  const exit: Statement = {kind: "if", test: call("stop"), consequent: block([effect, {kind: "break"}]), branches: []};
  expect(refine([effect, exit]).body.statements[0]).toMatchObject({kind: "while", test: lit(true)});
});

const fixture = (name: string) => readFileSync(new URL(`./fixtures/loop-condition-presentation/${name}`, import.meta.url));
const manifest = JSON.parse(fixture("manifest.json").toString()) as {
  source: string; sourceSha256: string; entries: Array<{profile: string; bytecode: string; sha256: string}>;
};
for (const entry of manifest.entries) {
  it(`keeps the sealed ordered latch/capture/arity control valid at ${entry.profile}`, () => {
    const bytes = fixture(entry.bytecode);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(entry.sha256);
    expect(createHash("sha256").update(fixture(manifest.source)).digest("hex")).toBe(manifest.sourceSha256);
    const result = decompile(bytes, {opcodeEncoding: "official"});
    if (!result.ok) throw new Error(result.error);
    expect(result.validation).toEqual([]);
    expect([...analyzeBindings(result.ast.body).globals].sort()).toEqual(["print", "select", "table", "tostring"]);
    expect(result.source).toContain("repeat");
    expect(result.source).toContain("until");
  });
}
