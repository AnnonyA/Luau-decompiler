import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {expect, it} from "vitest";
import {analyzeBindings} from "../src/analysis/Bindings.ts";
import {block, chunk, ident, lit, type Expression, type Statement} from "../src/ast/Ast.ts";
import {decompile} from "../src/decompile.ts";
import {printLuau} from "../src/print/LuauPrinter.ts";

const call = (name = "produce"): Expression => ({kind: "call", callee: ident(name), args: [], open: false});
const paren = (expression: Expression): Expression => ({kind: "paren", expression});
const print = (statements: Statement[]) => printLuau(chunk(statements));

it.each([
  call(),
  {kind: "method-call", object: ident("object"), name: "produce", args: [], open: false},
  {kind: "vararg"},
] as Expression[])("keeps the adjustment in the AST while printing a scalar %j", value => {
  const adjusted = paren(paren(value));
  const ast = chunk([{kind: "local", names: ["result"], values: [adjusted]}]);
  const before = JSON.stringify(ast);
  expect(printLuau(ast)).toBe(`local result = ${print([{kind: "return", values: [value]}]).slice(7)}`);
  expect(JSON.stringify(ast)).toBe(before);
});

it("keeps one-result tails when extra assignment destinations must receive nil", () => {
  const scalar = paren(call());
  expect(print([
    {kind: "local", names: ["first", "second"], values: [scalar]},
    {kind: "assign", targets: [ident("first"), ident("second")], values: [scalar]},
  ])).toBe("local first, second = (produce())\nfirst, second = (produce())\n");
});

it("only removes the final adjustment when assignment slots are exactly filled", () => {
  const scalar = paren(call());
  expect(print([
    {kind: "local", names: ["first", "second"], values: [scalar, scalar]},
    {kind: "assign", targets: [ident("first"), ident("second")], values: [scalar, scalar]},
  ])).toBe("local first, second = produce(), produce()\nfirst, second = produce(), produce()\n");
});

it("keeps spreading tails in arguments, returns, constructors and generic loops", () => {
  const scalar = paren(call());
  expect(print([{kind: "expression-stmt", expression: {...call("observe"), args: [scalar, scalar]} as Expression}]))
    .toBe("observe(produce(), (produce()))\n");
  expect(print([{kind: "return", values: [scalar, scalar]}])).toBe("return produce(), (produce())\n");
  expect(print([{kind: "return", values: [{kind: "table", fields: [{value: scalar}, {value: scalar}]}]}]))
    .toBe("return { produce(), (produce()) }\n");
  expect(print([{kind: "generic-for", names: ["key"], iterators: [scalar], body: block([])}]))
    .toBe("for key in (produce()) do\nend\n");
});

it("keeps zero-result and nil-containing call packs distinct from their scalar adjustments", () => {
  const open = call("values");
  const scalar = paren(open);
  expect(print([{kind: "return", values: [open]}])).toBe("return values()\n");
  expect(print([{kind: "return", values: [scalar]}])).toBe("return (values())\n");
  expect(print([{kind: "return", values: [{kind: "if-expr", test: ident("flag"),
    consequent: scalar, branches: [], alternate: paren(call("empty"))}]}]))
    .toBe("return if flag then values() else empty()\n");
});

it("adjusts keyed and non-final positional constructor values without reopening its tail", () => {
  const scalar = paren(call());
  expect(print([{kind: "return", values: [{kind: "table", fields: [
    {value: scalar}, {key: paren(call("key")), value: scalar}, {value: scalar},
  ]}]}])).toBe("return { produce(), [key()] = produce(), (produce()) }\n");
});

it("never removes callee boundaries or identity-preserving call grouping", () => {
  const guarded: Expression = {kind: "call", callee: {kind: "property", object: ident("math"), name: "floor"},
    args: [lit(1.5)], open: false, preserveBoundary: true};
  const identity: Expression = {kind: "call", callee: ident("factory"), args: [], open: false, inlineForIdentity: true};
  expect(print([
    {kind: "local", names: ["number"], values: [paren(guarded)]},
    {kind: "local", names: ["callback"], values: [paren(identity)]},
  ])).toBe("local number = (math.floor)(1.5)\nlocal callback = (factory())\n");
});

it("keeps grouping that protects precedence and anonymous function names", () => {
  const anonymous: Expression = {kind: "function-expr", params: [], isVararg: false, body: block([])};
  const sum: Expression = {kind: "binary", op: "+", left: ident("a"), right: ident("b")};
  expect(print([{kind: "local", names: ["callback"], values: [paren(anonymous)]}]))
    .toBe("local callback = (function()\nend)\n");
  expect(print([{kind: "return", values: [{kind: "binary", op: "*", left: paren(sum), right: paren(call())}]}]))
    .toBe("return (a + b) * produce()\n");
});

const fixture = (name: string) => readFileSync(new URL(`./fixtures/scalar-parentheses/${name}`, import.meta.url));
const manifest = JSON.parse(fixture("manifest.json").toString()) as {
  source: string; sourceSha256: string; entries: Array<{profile: string; bytecode: string; sha256: string}>;
};
function nodes(value: unknown, kind: string): Record<string, any>[] {
  if (!value || typeof value !== "object") return [];
  const node = value as Record<string, any>;
  return [...(node.kind === kind ? [node] : []), ...Object.values(node).flatMap(child => nodes(child, kind))];
}
for (const entry of manifest.entries) {
  it(`retains scalar iterator and call result adjustments at ${entry.profile}`, () => {
    const bytes = fixture(entry.bytecode);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(entry.sha256);
    expect(createHash("sha256").update(fixture(manifest.source)).digest("hex")).toBe(manifest.sourceSha256);
    const result = decompile(bytes, {opcodeEncoding: "official"});
    if (!result.ok) throw new Error(result.error);
    expect(result.validation).toEqual([]);
    expect([...analyzeBindings(result.ast.body).globals].sort()).toEqual(["debug", "error", "print", "select", "table", "tostring"]);
    const loop = nodes(result.ast, "generic-for").find(loop =>
      nodes(loop.body, "literal").some(node => node.value === "iteration"));
    expect(loop).toBeDefined();
    const tail = loop!.iterators.at(-1);
    expect(tail.kind).not.toBe("call");
    expect(tail.kind).not.toBe("method-call");
    expect(tail.kind).not.toBe("vararg");
  });
}
