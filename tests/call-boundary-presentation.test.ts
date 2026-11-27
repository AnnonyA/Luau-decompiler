import { expect, it } from "vitest";
import { block, chunk, ident, lit, type Expression, type Statement } from "../src/ast/Ast.js";
import { groupedCallBoundaries } from "../src/print/CallBoundaries.js";
import { printLuau } from "../src/print/LuauPrinter.js";

const invoke = (callee: Expression): Extract<Expression, {kind: "call"}> =>
  ({kind: "call", callee, args: [], open: false, preserveBoundary: true});
const fn = (isVararg = false): Expression =>
  ({kind: "function-expr", params: [], isVararg, body: block([{kind: "return", values: [ident("token")]}])});
const local = (name: string, value: Expression): Statement => ({kind: "local", names: [name], values: [value]});
const output = (prefix: Statement[], call: Expression) => printLuau(chunk([...prefix, {kind: "return", values: [call]}]));

it("keeps global and runtime field calls grouped to block new builtin recognition", () => {
  expect(output([], invoke({kind: "property", object: ident("math"), name: "floor"})))
    .toBe("return (math.floor)()\n");
  expect(output([local("service", {kind: "call", callee: ident("resolve"), args: [], open: false})],
    invoke({kind: "property", object: ident("service"), name: "fetch"})))
    .toContain("return (service.fetch)()\n");
});

it("retains the strong boundary through immutable literal aliases", () => {
  expect(output([local("original", fn()), local("alias", ident("original"))], invoke(ident("alias"))))
    .toContain("return (true and alias)()\n");
});

it("retains the strong boundary for a function in a local table initializer", () => {
  expect(output([local("methods", {kind: "table", fields: [{name: "run", value: fn()}]})],
    invoke({kind: "property", object: ident("methods"), name: "run"})))
    .toContain("return (true and methods.run)()\n");
});

it("resolves a parameter independently of a same-named outer literal", () => {
  const call = invoke(ident("handler"));
  const ast = chunk([local("handler", fn()), {kind: "function-decl", name: "apply", local: true,
    params: ["handler"], isVararg: false, body: block([{kind: "return", values: [call]}])}]);
  expect(groupedCallBoundaries(ast.body).has(call)).toBe(true);
  expect(printLuau(ast)).toContain("return (handler)()\n");
});

it("keeps a captured immutable literal protected in a nested function", () => {
  const call = invoke(ident("handler"));
  const ast = chunk([local("handler", fn()), {kind: "function-decl", name: "apply", local: true,
    params: [], isVararg: false, body: block([{kind: "return", values: [call]}])}]);
  expect(groupedCallBoundaries(ast.body).has(call)).toBe(false);
  expect(printLuau(ast)).toContain("return (true and handler)()\n");
});

it("does not infer a literal initializer for a rewritten or variadic function", () => {
  expect(output([local("handler", fn()), {kind: "assign", targets: [ident("handler")], values: [ident("replacement")]}],
    invoke(ident("handler")))).toContain("return (handler)()\n");
  expect(output([local("handler", fn(true))], invoke(ident("handler"))))
    .toContain("return (handler)()\n");
});

it("does not create another adjustment around an already grouped callee", () => {
  expect(output([], invoke({kind: "paren", expression: ident("external")})))
    .toBe("return (external)()\n");
});

it("prints scalar constant-string table keys in record form", () => {
  const table: Expression = {kind: "table", fields: [
    {key: lit("code"), value: lit(5)}, {key: lit("two words"), value: lit(6)},
    {key: lit("end"), value: lit(7)}, {key: ident("dynamic"), value: lit(8)},
  ]};
  expect(output([], table)).toBe('return { code = 5, ["two words"] = 6, ["end"] = 7, [dynamic] = 8 }\n');
});

it.each([undefined, "other", "run"])("preserves a table function's recorded debug name %s", debugName => {
  const value: Expression = {...fn(), debugName} as Extract<Expression, {kind: "function-expr"}>;
  const table: Expression = {kind: "table", fields: [{key: lit("run"), value}]};
  expect(output([], table)).toContain(debugName === "run" ? "run = function" : '["run"] = function');
});
