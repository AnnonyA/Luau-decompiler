import {describe, expect, it} from "vitest";
import {block, chunk, ident, lit, type Expression, type FunctionExpression, type Statement} from "../src/ast/Ast.ts";
import {presentClosures} from "../src/ast/ClosurePresentation.ts";
import {cleanupAst} from "../src/ast/AstCleanup.ts";
import {decompile, defaultCleanupOptions} from "../src/decompile.ts";

// Project-authored function-field/environment probe, official 9d7748a4 O2/g1.
// The function is created before setfenv(1) and exported after it. Original
// execution prints nil; deferring creation to SETTABLEKS printed "changed".
const fieldBeforeEnvironment = Buffer.from("DgMGBXRva2VuBXByaW50Al9HB3NldGZlbnYHY2hhbmdlZARyZWFkAAIqAQAAAAgAAwwAAQAAAABAFgACAAIDAQQAAABAAAQAARgAAAAEAAAAAAABogEHAAABCgAWQQAAAAwAAQAAAABADAEDAAAAIEAPAQH7BAAAADUCAQAAAAAAQAMFAAYEAQAEBQEANgYIABUEAwEQAwJ5CQAAAAYEAAAPBQJ5CQAAABUFAQAVBAABFgABAAoDAgQAAABAAwMEAAAgQAMEBgADAQMFCAEGBwAAAAMGAQABAAEYAAAAAQAAAAEAAQEAAAABAAEAAAAAAQEAAAAAAC4B", "base64");

const fn = (): FunctionExpression => ({kind: "function-expr", params: [], isVararg: false,
  creationSite: {ownerProtoId: 3, pc: 10}, body: block([{kind: "return", values: [ident("token")]}])});
const local = (name: string, value: Expression): Statement => ({kind: "local", names: [name], values: [value]});
const call = (callee: Expression, args: Expression[] = []): Extract<Expression, {kind: "call"}> =>
  ({kind: "call", callee, args, open: false});
const invoke = (expression: Expression): Statement => ({kind: "expression-stmt", expression});
const prepared = (operandPcs: (number | undefined)[], ownerProtoId = 3) => ({ownerProtoId, pc: 20, operandPcs});
function present(consumer: Statement, options: {prefix?: Statement[]; creation?: FunctionExpression} = {}) {
  return presentClosures(chunk([...(options.prefix ?? []), local("f", options.creation ?? fn()), consumer]));
}
const retainsCreation = (result: ReturnType<typeof present>): boolean => result.body.statements.some(statement =>
  statement.kind === "local" && statement.names.includes("f"));

describe("closure creation evaluation order", () => {
  it("preserves field closure creation before setfenv through reconstruction and cleanup", () => {
    const result = decompile(fieldBeforeEnvironment, {opcodeEncoding: "official", runtimeContext: false});
    expect(result.ok).toBe(true);
    if (!result.ok) throw Error(result.error);
    expect(result.source.indexOf("return token")).toBeGreaterThanOrEqual(0);
    expect(result.source.indexOf("return token")).toBeLessThan(result.source.indexOf('token = "changed"'));
    expect(result.source).toMatch(/\(true and \w+\.read\)\(\)/);
  });

  it("keeps creation before an intervening environment-changing call", () => {
    const result = presentClosures(chunk([local("f", fn()), invoke(call(ident("swapEnvironment"))),
      {kind: "return", values: [ident("f")]}]));
    expect(retainsCreation(result)).toBe(true);
    expect(result.body.statements).toHaveLength(3);
  });

  it("does not move creation past an earlier effectful argument in the next statement", () => {
    const result = present(invoke(call(ident("consume"), [call(ident("effect")), ident("f")])),
      {prefix: [local("consume", ident("outerConsume")), local("effect", ident("outerEffect"))]});
    expect(retainsCreation(result)).toBe(true);
  });

  it.each(["property", "method receiver"])("does not move creation past an unproved %s lookup", kind => {
    const expression: Expression = kind === "property"
      ? call({kind: "property", object: ident("object"), name: "consume"}, [ident("f")])
      : {kind: "method-call", object: {kind: "property", object: ident("object"), name: "child"},
        name: "consume", args: [ident("f")], open: false};
    expect(retainsCreation(present(invoke(expression), {prefix: [local("object", ident("outerObject"))]}))).toBe(true);
  });

  it("restores a callback argument when bytecode prepared its receiver lookup before creation", () => {
    const expression: Expression = {kind: "method-call", object: {kind: "property", object: ident("object"), name: "child"}, name: "consume",
      args: [ident("f")], open: false, evaluation: prepared([4, 10])};
    const result = present(invoke(expression), {prefix: [local("object", ident("outerObject"))]});
    expect(retainsCreation(result)).toBe(false);
    const last = result.body.statements.at(-1)!;
    expect(last.kind === "expression-stmt" && last.expression.kind === "method-call" &&
      last.expression.args[0]?.kind).toBe("function-expr");
  });

  it("keeps colon method lookup after callback creation as in the official compiler", () => {
    const expression: Expression = {kind: "method-call", object: ident("object"), name: "consume",
      args: [ident("f")], open: false};
    expect(retainsCreation(present(invoke(expression), {prefix: [local("object", ident("outerObject"))]}))).toBe(false);
  });

  it("accepts an effectful earlier operand with same-owner SSA evidence before creation", () => {
    const expression = {...call(ident("consume"), [call(ident("effect")), ident("f")]),
      evaluation: prepared([4, 7, 10])};
    expect(retainsCreation(present(invoke(expression)))).toBe(false);
  });

  it.each([
    ["another owner", prepared([4, 7, 10], 2)],
    ["later effect", prepared([4, 12, 10])],
    ["missing definition", prepared([4, undefined, 10])],
  ] as const)("rejects a prepared-prefix claim with %s", (_reason, evaluation) => {
    const expression = {...call(ident("consume"), [call(ident("effect")), ident("f")]), evaluation};
    expect(retainsCreation(present(invoke(expression)))).toBe(true);
  });

  it("does not mistake a table allocation PC for the evaluation time of its field effects", () => {
    const table: Expression = {kind: "table", fields: [{name: "value", value: call(ident("effect"))}]};
    const expression = {...call(ident("consume"), [table, ident("f")]), evaluation: prepared([4, 7, 10])};
    expect(retainsCreation(present(invoke(expression)))).toBe(true);
  });

  it("keeps unconditional creation outside a conditional expression arm", () => {
    const expression: Expression = {kind: "if-expr", test: ident("condition"), consequent: ident("f"),
      branches: [], alternate: lit(null)};
    expect(retainsCreation(present({kind: "return", values: [expression]},
      {prefix: [local("condition", lit(true))]}))).toBe(true);
  });

  it.each(["callee", "return"])("permits a direct %s use with no earlier effects", kind => {
    const consumer: Statement = kind === "callee" ? invoke(call(ident("f"), [call(ident("effect"))]))
      : {kind: "return", values: [ident("f")]};
    expect(retainsCreation(present(consumer))).toBe(false);
  });

  it("does not treat an unresolved global callee as an inert local read", () => {
    expect(retainsCreation(present(invoke(call(ident("consume"), [ident("f")]))))).toBe(true);
    expect(retainsCreation(present(invoke(call(ident("consume"), [ident("f")])),
      {prefix: [local("consume", ident("outerConsume"))]}))).toBe(false);
  });

  it("keeps mandatory recovered capture initializers even for a direct return", () => {
    const creation = {...fn(), closureIdentity: {ownerProtoId: 3, constantIndex: 1, childProtoId: 0,
      pc: 10, captureCount: 0, inlineCaptureInitializer: true}};
    expect(retainsCreation(present({kind: "return", values: [ident("f")]}, {creation}))).toBe(true);
  });

  it.each([false, true])("keeps an exported closure before intervening effects (pinned=%s)", pinned => {
    const creation = fn();
    if (pinned) creation.closureIdentity = {ownerProtoId: 3, constantIndex: 1, childProtoId: 0,
      pc: 10, captureCount: 0, inlineCaptureInitializer: true};
    const ast = chunk([local("record", {kind: "table", fields: []}), local("f", creation),
      invoke(call(ident("swapEnvironment"))), {kind: "assign",
        targets: [{kind: "property", object: ident("record"), name: "read"}], values: [ident("f")]},
      {kind: "return", values: [ident("record")]}]);
    const result = cleanupAst(ast, defaultCleanupOptions());
    const declaration = result.body.statements.findIndex(statement => statement.kind === "local" &&
      statement.values[0]?.kind === "function-expr" && statement.values[0].creationSite?.pc === 10);
    const effect = result.body.statements.findIndex(statement => statement.kind === "expression-stmt");
    expect(declaration).toBeGreaterThanOrEqual(0);
    expect(declaration).toBeLessThan(effect);
  });

  it("keeps a pinned direct initializer even when its export is adjacent", () => {
    const creation = {...fn(), closureIdentity: {ownerProtoId: 3, constantIndex: 1, childProtoId: 0,
      pc: 10, captureCount: 0, inlineCaptureInitializer: true}};
    const ast = chunk([local("record", {kind: "table", fields: []}), local("f", creation),
      {kind: "assign", targets: [{kind: "property", object: ident("record"), name: "read"}], values: [ident("f")]},
      {kind: "return", values: [ident("record")]}]);
    const result = cleanupAst(ast, defaultCleanupOptions());
    expect(result.body.statements.some(statement => statement.kind === "local" && statement.values[0]?.kind === "function-expr" &&
      statement.values[0].closureIdentity?.inlineCaptureInitializer && statement.values[0].creationSite?.pc === 10)).toBe(true);
  });
});
