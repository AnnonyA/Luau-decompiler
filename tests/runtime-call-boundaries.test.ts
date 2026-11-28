import {expect, it} from "vitest";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {block, chunk, ident, lit, type CallExpression, type Expression, type Statement} from "../src/ast/Ast.js";
import {decompile} from "../src/decompile.js";
import {analyzeCallBoundaries} from "../src/print/CallBoundaries.js";
import {printLuau} from "../src/print/LuauPrinter.js";

const call = (callee: Expression, args: Expression[] = []): CallExpression =>
  ({kind: "call", callee, args, open: true, preserveBoundary: true});
const local = (name: string, value: Expression): Statement => ({kind: "local", names: [name], values: [value]});
const check = (prefix: Statement[], invocation: CallExpression) => {
  const ast = chunk([...prefix, {kind: "return", values: [invocation]}]);
  return {direct: analyzeCallBoundaries(ast.body).direct.has(invocation), source: printLuau(ast)};
};

it("retains one computed lookup, argument order, open results and bytecode boundary metadata", () => {
  const lookup: Expression = {kind: "index", table: ident("callbacks"), key: call(ident("nextKey"))};
  const invocation = call(lookup, [call(ident("first")), {kind: "vararg"}]);
  const result = check([], invocation);
  expect(result.direct).toBe(true);
  expect(result.source).toBe("return callbacks[(nextKey)()]((first)(), ...)\n");
  expect(invocation.callee).toBe(lookup);
  expect(invocation.open).toBe(true);
  expect(invocation.preserveBoundary).toBe(true);
});

it("keeps a returned callable scalar without adding an outer callee group", () => {
  const factory = call(ident("resolve"));
  const invocation = call(factory, [lit(7)]);
  const result = check([], invocation);
  expect(result.direct).toBe(true);
  expect(result.source).toBe("return (resolve)()(7)\n");
  expect(factory.preserveBoundary).toBe(true);
});

it("follows immutable callable aliases to a runtime result", () => {
  const invocation = call(ident("alias"), [{kind: "vararg"}]);
  const result = check([local("value", call(ident("resolve"))), local("alias", ident("value"))], invocation);
  expect(result.direct).toBe(true);
  expect(result.source).toContain("return alias(...)\n");
});

it("admits a field read from an object returned by a method", () => {
  const object: Expression = {kind: "method-call", object: ident("service"), name: "resolve", args: [], open: false};
  const invocation = call({kind: "property", object: ident("record"), name: "run"});
  expect(check([local("record", object)], invocation)).toEqual({direct: true,
    source: "local record = service:resolve()\nreturn record.run()\n"});
});

it("keeps globals and global-library aliases protected from builtin recognition", () => {
  for (const target of [ident("external"), {kind: "property", object: ident("math"), name: "abs"} as Expression]) {
    const invocation = call(ident("alias"));
    expect(check([local("alias", target)], invocation).direct).toBe(false);
  }
  const invocation = call({kind: "property", object: ident("library"), name: "abs"});
  expect(check([local("library", {kind: "binary", op: "or", left: ident("math"), right: ident("fallback")})], invocation).direct).toBe(false);
});

it("does not mistake a fixed-arity parameter or its alias for a stable runtime target", () => {
  for (const target of [ident("callable"), ident("alias"), {kind: "property", object: ident("callable"), name: "run"} as Expression]) {
    const invocation = call(target);
    const ast = chunk([{kind: "function-decl", local: true, name: "apply", params: ["callable"], isVararg: false,
      body: block([local("alias", ident("callable")), {kind: "return", values: [invocation]}])}]);
    expect(analyzeCallBoundaries(ast.body).direct.has(invocation)).toBe(false);
    expect(invocation.preserveBoundary).toBe(true);
  }
});

it("rejects reused identifier nodes that resolve to different bindings", () => {
  const shared = ident("target");
  const first = call(shared);
  const second = call(shared);
  const ast = chunk([local("target", call(ident("resolve"))), {kind: "expression-stmt", expression: first},
    {kind: "function-decl", local: true, name: "apply", params: ["target"], isVararg: false,
      body: block([{kind: "return", values: [second]}])}]);
  expect(analyzeCallBoundaries(ast.body).direct.has(first)).toBe(false);
  expect(analyzeCallBoundaries(ast.body).direct.has(second)).toBe(false);
});

it("keeps explicit identity-recovery calls out of the presentation proof", () => {
  const invocation = call({kind: "index", table: ident("factories"), key: lit(1)});
  invocation.inlineForIdentity = true;
  expect(check([], invocation)).toEqual({direct: false, source: "return (factories[1]())\n"});
});

it("pins and reconstructs all independently authored controls from both official compiler revisions", () => {
  const fixture = (name: string) => readFileSync(new URL(`./fixtures/runtime-call-boundaries/${name}`, import.meta.url));
  const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
  const manifest = JSON.parse(fixture("manifest.json").toString()) as {entries: Array<{
    id: string; compilerRevision: string; source: string; sourceSha256: string; bytecode: string; bytecodeSha256: string;
  }>};
  expect(manifest.entries).toHaveLength(36);
  expect(new Set(manifest.entries.map(entry => entry.compilerRevision))).toEqual(new Set([
    "9d7748a4f324213a18cb8283fa2a77c330225fa0", "c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f",
  ]));
  for (const entry of manifest.entries) {
    const bytecode = fixture(entry.bytecode);
    expect(digest(fixture(entry.source)), entry.id).toBe(entry.sourceSha256);
    expect(digest(bytecode), entry.id).toBe(entry.bytecodeSha256);
    const result = decompile(bytecode, {opcodeEncoding: "official", runtimeContext: false});
    if (!result.ok) throw Error(`${entry.id}: ${result.error}`);
    expect(result.validation, entry.id).toEqual([]);
    expect(result.diagnostics.filter(item => item.severity === "error"), entry.id).toEqual([]);
  }
});
