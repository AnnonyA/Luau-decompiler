import { expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { block, chunk, ident, lit, type Expression, type Statement, type TableExpression } from "../src/ast/Ast.ts";
import { foldTemporaries } from "../src/ast/TempFolding.ts";
import { printLuau } from "../src/print/LuauPrinter.ts";
import { decompile } from "../src/decompile.ts";
import { abc, ad, compile, Opcode, proto, strings } from "./helpers.ts";

const call = (name: string, args: Expression[] = []): Expression => ({kind: "call", callee: ident(name), args, open: false});
const empty = (): TableExpression => ({kind: "table", fields: [], templateKeys: ["ready"]});
const store = (value: Expression, key: Expression = lit("ready")): Statement => ({kind: "assign",
  targets: [{kind: "index", table: ident("record"), key}], values: [value]});
const declaration = (value: TableExpression = empty()): Statement => ({kind: "local", names: ["record"], values: [value]});
const returned = (): Statement => ({kind: "return", values: [ident("record")]});
const source = (statements: Statement[]): string => printLuau(foldTemporaries(chunk(statements)));
const fn = (): Expression => ({kind: "function-expr", params: [], isVararg: false,
  body: block([{kind: "return", values: [lit(4)]}])});

it("restores the unique reserved field with its initializer evaluated once", () => {
  expect(source([declaration(), store(call("read")), {kind: "return", values: [ident("record")]}]))
    .toBe("local record = { ready = read() }\nreturn record\n");
});

it("replaces the unobserved loader zero without adding a second hash key", () => {
  const table = empty();
  table.fields.push({name: "ready", value: lit(0)});
  expect(source([declaration(table), store(call("read")), returned()]))
    .toBe("local record = { ready = read() }\nreturn record\n");
});

it("retains a loader zero when the field is read before its explicit store", () => {
  const bytes = compile(proto({
    constants: [...strings("ready"), {kind: "table", keys: [0]}, ...strings("print")],
    instructions: [
      ad(Opcode.DUPTABLE, 0, 1),
      abc(Opcode.GETTABLEKS, 1, 0, 0), 0,
      abc(Opcode.GETGLOBAL, 2, 0, 0), 2,
      abc(Opcode.MOVE, 3, 1, 0), abc(Opcode.CALL, 2, 2, 1),
      ad(Opcode.LOADN, 4, 5), abc(Opcode.SETTABLEKS, 4, 0, 0), 0,
      abc(Opcode.GETTABLEKS, 3, 0, 0), 0,
      abc(Opcode.GETGLOBAL, 2, 0, 0), 2,
      abc(Opcode.CALL, 2, 2, 1), abc(Opcode.RETURN, 0, 1, 0),
    ],
  }));
  const result = decompile(bytes, {opcodeEncoding: "official"});
  if (!result.ok) throw new Error(result.error);
  expect(result.validation).toEqual([]);
  expect(result.source).toContain("ready = 0");
  expect(result.source).toContain(".ready = 5");
  expect(result.source.indexOf("print(")).toBeLessThan(result.source.indexOf(".ready = 5"));
  const base = new URL("./fixtures/single-template-field/", import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL("synthetic-manifest.json", base), "utf8"));
  const sealed = readFileSync(new URL(manifest.bytecode, base));
  expect(createHash("sha256").update(sealed).digest("hex")).toBe(manifest.sha256);
  expect(Buffer.from(bytes)).toEqual(sealed);
});

it.each([lit(null), lit(false), {kind: "vararg"}, call("many")])("retains scalar field adjustment for %o", value => {
  const result = foldTemporaries(chunk([declaration(), store(value as Expression), returned()]));
  const first = result.body.statements[0]!;
  expect(result.body.statements).toHaveLength(2);
  expect(first.kind).toBe("local");
  if (first.kind === "local") expect(first.values).toEqual([{...empty(), fields: [{name: "ready", value}]}]);
});

it.each(["unknown", "wrong-template", "wrong-key", "dynamic-key", "existing-field", "array-slot", "metamethod"])
  ("retains %s indexed storage", kind => {
    const table = empty();
    let key: Expression = lit("ready");
    if (kind === "unknown") delete table.templateKeys;
    if (kind === "wrong-template") table.templateKeys = ["other"];
    if (kind === "wrong-key") key = lit("other");
    if (kind === "dynamic-key") key = call("key");
    if (kind === "existing-field") table.fields.push({name: "ready", value: lit(false)});
    if (kind === "array-slot") table.fields.push({list: true, value: lit(1)});
    if (kind === "metamethod") table.templateKeys = ["__index"], key = lit("__index");
    const result = foldTemporaries(chunk([declaration(table), store(call("read"), key)]));
    expect(result.body.statements.filter(statement => statement.kind === "assign")).toHaveLength(1);
  });

it("does not expand the one-node reservation with later fields or absorb overwrites", () => {
  for (const target of [{kind: "property", object: ident("record"), name: "later"},
    {kind: "index", table: ident("record"), key: lit("ready")}] as Expression[]) {
    const result = foldTemporaries(chunk([declaration(), store(call("first")),
      {kind: "assign", targets: [target], values: [call("second")]}, returned()]));
    expect(result.body.statements).toHaveLength(3);
    expect(result.body.statements[1]).toMatchObject({kind: "assign", targets: [target]});
  }
});

it("keeps an initializer which can observe the declared table", () => {
  for (const value of [ident("record"), call("observe", [ident("record")]),
    {kind: "if-expr", test: call("condition"), consequent: ident("record"), branches: [], alternate: lit(false)}] as Expression[]) {
    expect(source([declaration(), store(value)])).toContain('record["ready"] =');
  }
});

it("keeps function literal spelling even through a conditional, argument or nested record", () => {
  const values: Expression[] = [fn(),
    {kind: "if-expr", test: call("condition"), consequent: fn(), branches: [], alternate: fn()},
    call("wrap", [fn()]), {kind: "table", fields: [{name: "callback", value: fn()}]}];
  for (const value of values) expect(source([declaration(), store(value), returned()])).toContain('record["ready"] =');
});

it("retains a field store after an intervening observer", () => {
  expect(source([declaration(), {kind: "expression-stmt", expression: call("observe", [ident("record")])}, store(call("read"))]))
    .toContain('record["ready"] = read()');
});

it("pins all independently executed normal and Hard inputs without discarding the first layout failure", () => {
  const base = new URL("./fixtures/single-template-field/", import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL("manifest.json", base), "utf8")) as {
    sources: Array<{name: string; sourceSha256: string; bytecodes: Array<{profile: string; path: string; sha256: string}>}>;
  };
  expect(manifest.sources).toHaveLength(3);
  for (const source of manifest.sources) {
    expect(createHash("sha256").update(readFileSync(new URL(source.name + ".luau", base))).digest("hex"))
      .toBe(source.sourceSha256);
    expect(source.bytecodes).toHaveLength(12);
    for (const entry of source.bytecodes) {
      const bytes = readFileSync(new URL(entry.path, base));
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(entry.sha256);
      const result = decompile(bytes, {opcodeEncoding: "official"});
      if (!result.ok) throw new Error(source.name + "/" + entry.profile + ": " + result.error);
      expect(result.validation).toEqual([]);
    }
  }
});
