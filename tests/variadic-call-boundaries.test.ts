import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {expect, it} from "vitest";
import {block, chunk, ident, lit, type Expression, type FunctionExpression, type Statement} from "../src/ast/Ast.ts";
import {analyzeCallBoundaries} from "../src/print/CallBoundaries.ts";
import {printLuau} from "../src/print/LuauPrinter.ts";
import {analyzeBindings} from "../src/analysis/Bindings.ts";
import {decompile} from "../src/decompile.ts";

const local = (name: string, value: Expression): Statement => ({kind: "local", names: [name], values: [value]});
const call = (name: string): Extract<Expression, {kind: "call"}> =>
  ({kind: "call", callee: ident(name), args: [{kind: "vararg"}], open: true, preserveBoundary: true});
const variadic = (): FunctionExpression => ({kind: "function-expr", params: [], isVararg: true,
  body: block([{kind: "expression-stmt", expression: {kind: "call", callee: ident("observeFrame"), args: [], open: false}},
    {kind: "return", values: [{kind: "vararg"}]}])});

it("keeps a known literal's variadic signature, body effects and open argument/result pack", () => {
  const invocation = call("helper");
  const ast = chunk([local("helper", variadic()), {kind: "return", values: [invocation]}]);
  expect(analyzeCallBoundaries(ast.body).direct.has(invocation)).toBe(true);
  expect(printLuau(ast)).toBe("local helper = function(...)\n    observeFrame()\n    return ...\nend\nreturn helper(...)\n");
  expect(invocation.open).toBe(true);
  expect(invocation.preserveBoundary).toBe(true);
});

it("follows immutable aliases without interpreting an unknown field as a literal", () => {
  const invocation = call("alias");
  const ast = chunk([local("helper", variadic()), local("alias", ident("helper")), {kind: "return", values: [invocation]}]);
  expect(analyzeCallBoundaries(ast.body).direct.has(invocation)).toBe(true);
  invocation.callee = {kind: "property", object: ident("record"), name: "helper"};
  expect(analyzeCallBoundaries(ast.body).direct.has(invocation)).toBe(false);
});

it("uses the written-local proof independently of an earlier variadic initializer", () => {
  const invocation = call("helper");
  const ast = chunk([local("helper", variadic()), {kind: "assign", targets: [ident("helper")], values: [ident("replacement")]},
    {kind: "return", values: [invocation]}]);
  expect(analyzeCallBoundaries(ast.body).direct.has(invocation)).toBe(true);
  expect(printLuau(ast)).toContain("return helper(...)");
  expect(invocation.preserveBoundary).toBe(true);
});

it("distinguishes a same-named parameter from the outer known variadic function", () => {
  const invocation = call("helper");
  const ast = chunk([local("helper", variadic()), {kind: "function-decl", local: true, name: "apply", params: ["helper"],
    isVararg: true, body: block([{kind: "return", values: [invocation]}])}]);
  expect(analyzeCallBoundaries(ast.body).direct.has(invocation)).toBe(false);
});

it("keeps fixed-arity literals and explicit identity recovery on their existing paths", () => {
  const invocation = call("helper");
  const ast = chunk([local("helper", {...variadic(), isVararg: false}), {kind: "return", values: [invocation]}]);
  expect(analyzeCallBoundaries(ast.body).direct.has(invocation)).toBe(false);
  invocation.inlineForIdentity = true;
  invocation.args = [lit(null)];
  expect(analyzeCallBoundaries(ast.body).direct.has(invocation)).toBe(false);
  expect(printLuau(ast)).toContain("return (helper(nil))");
});

const fixture = (name: string) => readFileSync(new URL(`./fixtures/variadic-call-boundaries/${name}`, import.meta.url));
const manifest = JSON.parse(fixture("manifest.json").toString()) as {
  source: string; sourceSha256: string; entries: Array<{profile: string; bytecode: string; sha256: string}>;
};
for (const entry of manifest.entries) {
  it(`retains the sealed frame/argument/capture/result-pack control at ${entry.profile}`, () => {
    const bytes = fixture(entry.bytecode);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(entry.sha256);
    expect(createHash("sha256").update(fixture(manifest.source)).digest("hex")).toBe(manifest.sourceSha256);
    const result = decompile(bytes, {opcodeEncoding: "official", runtimeContext: false});
    if (!result.ok) throw Error(result.error);
    expect(result.validation).toEqual([]);
    expect([...analyzeBindings(result.ast.body).globals].sort()).toEqual(["debug", "print", "select", "setmetatable", "table"]);
    expect(analyzeCallBoundaries(result.ast.body).direct.size).toBeGreaterThan(0);
    expect(result.source).toContain("...");
  });
}
