import {expect, it} from "vitest";
import {block, chunk, ident, lit, type Expression, type Statement} from "../src/ast/Ast.ts";
import {recoverPrivateLogicalReturns} from "../src/ast/StructureRefinement.ts";
import {printLuau} from "../src/print/LuauPrinter.ts";

const call = (name: string): Expression => ({kind: "call", callee: ident(name), args: [], open: false});
const compare = (name: string): Expression => ({kind: "binary", op: "==", left: call(name), right: lit(1)});
const ret = (value: Expression = ident("result")): Statement => ({kind: "return", values: [value]});
const assign = (value: Expression): Statement => ({kind: "assign", targets: [ident("result")], values: [value]});
const guard = (inverted = false): Statement => ({kind: "if", branches: [],
  test: inverted ? {kind: "unary", op: "not", argument: ident("result")} : ident("result"), consequent: block([ret()])});
function build(first: Expression, second: Expression, tail: Statement[], inverted = false): Statement[] {
  return [{kind: "local", names: ["result"], values: [first]}, guard(inverted), assign(second), ...tail];
}
const source = (statements: Statement[]) => printLuau(recoverPrivateLogicalReturns(chunk(statements)));

it.each([false, true])("recovers a flat chain with primitive intermediate results (and: %s)", inverted => {
  const output = source(build(compare("first"), compare("second"), [guard(inverted), assign(call("last")), ret()], inverted));
  expect(output).not.toContain("local result");
  expect(output).toContain(inverted ? "first() == 1 and second() == 1 and last()" : "first() == 1 or second() == 1 or last()");
});

it("joins a primitive prefix while keeping an effectful remaining tail after its guard", () => {
  const effect: Statement = {kind: "expression-stmt", expression: call("effect")};
  const output = source(build(compare("first"), compare("second"), [guard(), effect, ret()]));
  expect(output).toBe("local result = first() == 1 or second() == 1\nif result then\n    return result\nend\neffect()\nreturn result\n");
});

it("accepts only a primitive result on the right of and", () => {
  const primitive: Expression = {kind: "binary", op: "and", left: call("unknown"), right: compare("value")};
  expect(source(build(primitive, compare("second"), [ret()]))).not.toContain("local result");
  expect(source(build({...primitive, op: "or"}, compare("second"), [ret()]))).toContain("local result");
  expect(source(build({...primitive, left: compare("value"), right: call("unknown")}, compare("second"), [ret()]))).toContain("local result");
});

it("keeps object-valued locals and writes that may expose the result cell", () => {
  for (const first of [call("object"), ident("object"), {kind: "table", fields: []}] as Expression[]) {
    expect(source(build(first, compare("second"), [ret()]))).toContain("local result");
  }
  const captured: Expression = {kind: "function-expr", params: [], isVararg: false, body: block([ret()])};
  expect(source(build(compare("first"), compare("second"), [
    {kind: "local", names: ["reader"], values: [captured]}, guard(), ret(),
  ]))).toContain("local result");
});

it("does not combine guards of opposite polarity or drop closure creation", () => {
  const effect: Statement = {kind: "expression-stmt", expression: call("effect")};
  expect(source(build(compare("first"), compare("second"), [guard(true), effect, ret()]))).toContain("result = second()");
  const fn: Expression = {kind: "function-expr", params: [], isVararg: false, body: block([ret(lit(3))])};
  const first: Expression = {kind: "binary", op: "==", left: fn, right: ident("other")};
  expect(source(build(first, compare("second"), [ret()]))).toContain("local result");
});
