import {describe, expect, it} from "vitest";
import {block, chunk, ident, lit, type Expression, type Statement} from "../src/ast/Ast.ts";
import {presentNamedTableClosures} from "../src/ast/ClosurePresentation.ts";
import {printLuau} from "../src/print/LuauPrinter.ts";

const local = (name: string, value: Expression): Statement => ({kind: "local", names: [name], values: [value]});
const fn = (name = "read", body: Statement[] = [{kind: "return", values: [lit(7)]}]): Statement =>
  ({kind: "function-decl", local: true, name, params: [], isVararg: false, body: block(body),
    creationSite: {ownerProtoId: 1, pc: 3}});
const table = (name = "read", value: Expression = ident("read")): Expression =>
  ({kind: "table", fields: [{name, value}], templateKeys: [name]});
const call = (name: string): Expression => ({kind: "call", callee: ident(name), args: [], open: false});
const returned = (value: Expression): Statement => ({kind: "return", values: [value]});

describe("named table closure presentation", () => {
  it("restores a sole-use record closure and preserves its prototype name and table template", () => {
    const input = chunk([fn(), local("record", table()), returned(ident("record"))]);
    const before = structuredClone(input);
    const output = presentNamedTableClosures(input);
    expect(input).toEqual(before);
    expect(output.body.statements).toHaveLength(2);
    const declaration = output.body.statements[0]!;
    expect(declaration).toMatchObject({kind: "local", values: [{kind: "table", templateKeys: ["read"],
      fields: [{name: "read", value: {kind: "function-expr", debugName: "read", creationSite: {ownerProtoId: 1, pc: 3}}}]}]});
    expect(printLuau(output)).toContain("read = function()");
  });

  it("preserves the lexical source of captures in a same-named table initializer", () => {
    const input = chunk([local("record", lit(9)), fn("read", [returned(ident("record"))]),
      local("record", table()), returned(ident("record"))]);
    const output = presentNamedTableClosures(input);
    expect(output.body.statements).toHaveLength(3);
    expect(printLuau(output)).toContain("return record");
  });

  it.each(["alias", "list", "conditional"])("keeps function names outside a matching direct field (%s)", kind => {
    const value: Expression = kind === "alias" ? table("other") : kind === "list"
      ? {kind: "table", fields: [{list: true, value: ident("read")}]}
      : {kind: "if-expr", test: ident("enabled"), consequent: table(), branches: [], alternate: lit(null)};
    const input = chunk([fn(), returned(value)]);
    expect(presentNamedTableClosures(input)).toEqual(input);
  });

  it.each(["effect", "global", "lookup"])("does not move creation past an earlier %s", kind => {
    const prefix = kind === "effect" ? call("changeEnvironment") : kind === "global" ? ident("globalValue")
      : {kind: "property" as const, object: ident("object"), name: "value"};
    const value: Expression = {kind: "table", fields: [{name: "before", value: prefix}, {name: "read", value: ident("read")}]};
    const input = chunk([local("object", lit(null)), fn(), returned(value)]);
    expect(presentNamedTableClosures(input)).toEqual(input);
  });

  it("keeps recursive, shared and captured function bindings", () => {
    for (const statements of [
      [fn("read", [returned(call("read"))]), returned(table())],
      [fn(), local("alias", ident("read")), returned(table())],
      [fn(), fn("use", [returned(ident("read"))]), returned(table())],
      [fn(), {kind: "assign", targets: [ident("read")], values: [ident("replacement")]} as Statement, returned(table())],
    ]) {
      const input = chunk(statements);
      expect(presentNamedTableClosures(input)).toEqual(input);
    }
  });

  it("retains mandatory closure identity initializers", () => {
    const declaration = fn();
    if (declaration.kind !== "function-decl") throw Error();
    declaration.closureIdentity = {ownerProtoId: 1, childProtoId: 0, constantIndex: 0, pc: 3,
      captureCount: 0, inlineCaptureInitializer: true};
    const input = chunk([declaration, returned(table())]);
    expect(presentNamedTableClosures(input)).toEqual(input);
  });

  it("retains a uniform export table instead of nesting its adjacent suffix", () => {
    const input = chunk([fn("first"), fn("second"), returned({kind: "table", fields: [
      {name: "first", value: ident("first")}, {name: "second", value: ident("second")},
    ]})]);
    const output = presentNamedTableClosures(input);
    expect(output).toEqual(input);
  });

  it.each([lit(null), lit(NaN), ident("key")])("retains creation before a table store that can throw", key => {
    const input = chunk([local("key", lit(null)), fn(), returned({kind: "table", fields: [
      {key, value: lit(1)}, {name: "read", value: ident("read")},
    ]})]);
    expect(presentNamedTableClosures(input)).toEqual(input);
  });

  it("retains creation before a nested constructor's potentially invalid key", () => {
    const input = chunk([local("key", lit(null)), fn(), returned({kind: "table", fields: [
      {name: "prefix", value: {kind: "table", fields: [{key: ident("key"), value: lit(1)}]}},
      {name: "read", value: ident("read")},
    ]})]);
    expect(presentNamedTableClosures(input)).toEqual(input);
  });

  it("permits an invalid outer store after the closure has already been created", () => {
    const input = chunk([fn(), returned({kind: "table", fields: [{key: lit(null), value: table()}]})]);
    expect(presentNamedTableClosures(input).body.statements).toHaveLength(1);
  });
});
