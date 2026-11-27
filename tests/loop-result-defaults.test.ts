import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {expect, it} from "vitest";
import {analyzeBindings} from "../src/analysis/Bindings.ts";
import {block, chunk, ident, lit, type Expression, type Statement} from "../src/ast/Ast.ts";
import {recoverLoopResultDefaults} from "../src/ast/LoopResultDefaults.ts";
import {printLuau} from "../src/print/LuauPrinter.ts";
import {decompile} from "../src/decompile.ts";

const local = (name: string, value?: Expression): Extract<Statement, {kind: "local"}> =>
  ({kind: "local", names: [name], values: value ? [value] : []});
const assign = (name: string, value: Expression): Extract<Statement, {kind: "assign"}> =>
  ({kind: "assign", targets: [ident(name)], values: [value]});
const call = (name: string, args: Expression[] = []): Expression => ({kind: "call", callee: ident(name), args, open: false});
const effect = (name: string, args: Expression[] = []): Statement => ({kind: "expression-stmt", expression: call(name, args)});
const make = (kind: "while" | "repeat" | "numeric-for" | "generic-for" = "generic-for") => {
  const result = local("answer");
  const flag = {...local("tail", lit(true)), syntheticLoopTail: true as const};
  const success = assign("answer", {kind: "binary", op: "==", left: ident("value"), right: ident("target")});
  const clear = assign("tail", lit(false));
  const body = block([effect("before"), {kind: "if", test: call("found"),
    consequent: block([success, clear, {kind: "break"}]), branches: []}, effect("after")] as Statement[]);
  const loop: Extract<Statement, {kind: typeof kind}> = kind === "generic-for"
    ? {kind, names: ["value"], iterators: [call("iterate")], body}
    : kind === "numeric-for" ? {kind, name: "value", start: lit(1), stop: call("limit"), body}
    : kind === "while" ? {kind, test: call("ready"), body} : {kind, body, test: call("done")};
  const fallback = assign("answer", lit(false));
  const guard: Extract<Statement, {kind: "if"}> = {kind: "if", test: ident("tail"),
    consequent: block([fallback]), branches: []};
  const ast = chunk([result, flag, loop, guard, {kind: "return", values: [ident("answer"), lit(null), call("pack")]}]);
  return {ast, result, flag, loop, success, clear, fallback, guard};
};
const hasFlag = (ast: ReturnType<typeof make>["ast"]): boolean =>
  analyzeBindings(ast.body).bindings.some(binding => binding.declaration.kind === "local" && binding.declaration.syntheticLoopTail);

it.each(["while", "repeat", "numeric-for", "generic-for"] as const)(
  "initializes a private primitive result before its %s without moving loop effects or result packs", kind => {
    const input = make(kind);
    const result = recoverLoopResultDefaults(input.ast);
    expect(hasFlag(result)).toBe(false);
    expect(result.body.statements.map(statement => statement.kind)).toEqual(["local", "assign", kind, "return"]);
    expect(result.body.statements[1]).toBe(input.fallback);
    const loop = result.body.statements[2] as typeof input.loop;
    expect(loop.body.statements[0]).toBe(input.loop.body.statements[0]);
    expect(loop.body.statements[2]).toBe(input.loop.body.statements[2]);
    const branch = loop.body.statements[1];
    expect(branch?.kind).toBe("if");
    if (branch?.kind !== "if") throw Error("missing success arm");
    expect(branch.consequent.statements).toEqual([input.success, {kind: "break"}]);
    expect(result.body.statements.at(-1)).toBe(input.ast.body.statements.at(-1));
  });

it("places the default after an intervening result declaration", () => {
  const input = make();
  input.ast.body.statements.splice(0, 2, input.flag, input.result);
  const result = recoverLoopResultDefaults(input.ast);
  expect(result.body.statements[0]).toBe(input.result);
  expect(result.body.statements[1]).toBe(input.fallback);
  expect(analyzeBindings(result.body).globals.has("answer")).toBe(false);
});

it("does not rewrite a user flag without reconstruction provenance", () => {
  const input = make();
  delete (input.flag as {syntheticLoopTail?: true}).syntheticLoopTail;
  expect(recoverLoopResultDefaults(input.ast)).toBe(input.ast);
});

it.each(["answer", "tail"])("preserves a captured %s cell even when captured after the loop", name => {
  const input = make();
  input.ast.body.statements.splice(-1, 0, local("saved", {kind: "function-expr", params: [], isVararg: false,
    body: block([{kind: "return", values: [ident(name)]}])}));
  expect(recoverLoopResultDefaults(input.ast)).toBe(input.ast);
});

it.each(["body", "bounds"])("preserves an answer read in the loop %s", where => {
  const input = make("numeric-for");
  if (where === "body") input.loop.body.statements.unshift(effect("observe", [ident("answer")]));
  else if (input.loop.kind === "numeric-for") input.loop.stop = ident("answer");
  expect(recoverLoopResultDefaults(input.ast)).toBe(input.ast);
});

it.each(["initial table", "other writer", "open initializer", "arithmetic metamethod"])(
  "preserves earlier object lifetimes with an unproved %s", reason => {
    const input = make();
    if (reason === "initial table") input.result.values = [{kind: "table", fields: []}];
    if (reason === "other writer") input.ast.body.statements.splice(1, 0, assign("answer", call("object")));
    if (reason === "open initializer") {
      input.result.names = ["other", "answer"];
      input.result.values = [call("objects")];
    }
    if (reason === "arithmetic metamethod") input.success.values = [
      {kind: "binary", op: "+", left: ident("left"), right: ident("right")}];
    expect(recoverLoopResultDefaults(input.ast)).toBe(input.ast);
  });

it("does not move an effectful fallback to loop entry", () => {
  const input = make();
  input.fallback.values = [call("fallback")];
  expect(recoverLoopResultDefaults(input.ast)).toBe(input.ast);
});

it("does not confuse a nested-loop break with the current loop exit", () => {
  const input = make();
  input.loop.body = block([{kind: "while", test: call("inner"), body: block([input.success, input.clear, {kind: "break"}])}]);
  expect(recoverLoopResultDefaults(input.ast)).toBe(input.ast);
});

it.each(["missing break", "missing result", "later flag read", "unpaired result"])(
  "keeps the guard when its exit proof has a %s", reason => {
    const input = make();
    const branch = input.loop.body.statements[1];
    if (branch?.kind !== "if") throw Error("missing arm");
    if (reason === "missing break") branch.consequent.statements.pop();
    if (reason === "missing result") branch.consequent.statements.shift();
    if (reason === "later flag read") input.ast.body.statements.splice(-1, 0, effect("observe", [ident("tail")]));
    if (reason === "unpaired result") input.loop.body.statements.unshift(assign("answer", lit(true)));
    expect(recoverLoopResultDefaults(input.ast)).toBe(input.ast);
  });

it("does not confuse a shadowing result cell with the outer primitive result", () => {
  const input = make();
  input.loop.body.statements.unshift(local("answer", lit(false)));
  expect(recoverLoopResultDefaults(input.ast)).toBe(input.ast);
});

it("applies a nested plan without invalidating a containing loop plan", () => {
  const outer = make(), inner = make();
  inner.ast.body.statements.pop();
  outer.loop.body.statements.unshift({kind: "do", body: inner.ast.body});
  const result = recoverLoopResultDefaults(outer.ast);
  expect(hasFlag(result)).toBe(false);
  expect(printLuau(result).match(/answer = false/g)).toHaveLength(2);
});

const fixture = (name: string) => readFileSync(new URL(`./fixtures/loop-result-defaults/${name}`, import.meta.url));
const manifest = JSON.parse(fixture("manifest.json").toString()) as {
  source: string; sourceSha256: string; entries: Array<{profile: string; bytecode: string; sha256: string}>;
};
for (const entry of manifest.entries) {
  it(`keeps the sealed comparison-order/capture/arity program valid at ${entry.profile}`, () => {
    const bytes = fixture(entry.bytecode);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(entry.sha256);
    expect(createHash("sha256").update(fixture(manifest.source)).digest("hex")).toBe(manifest.sourceSha256);
    const result = decompile(bytes, {opcodeEncoding: "official", runtimeContext: false});
    if (!result.ok) throw Error(result.error);
    expect(result.validation).toEqual([]);
    expect([...analyzeBindings(result.ast.body).globals].sort()).toEqual(["ipairs", "print", "select", "setmetatable", "table"]);
    expect(result.source).toMatch(/(?:\["__eq"\]|\.__eq)\s*=/);
    if (entry.profile.startsWith("O2")) {
      // The observation closures must retain their captured result cells;
      // the private scalar searches no longer need reconstruction flags.
      expect(analyzeBindings(result.ast.body).bindings.some(binding => binding.captured)).toBe(true);
      expect(result.source).toContain("break");
    }
  });
}
