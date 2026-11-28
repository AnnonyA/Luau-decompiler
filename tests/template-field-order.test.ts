import {expect, it} from "vitest";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {block, ident, lit, type Expression, type TableField} from "../src/ast/Ast.ts";
import type {LuauConstant} from "../src/decode/Constant.ts";
import {decompile} from "../src/decompile.ts";
import {restoreTemplateFieldOrder} from "../src/reconstruct/TemplateFieldOrder.ts";

const string = (value: string): LuauConstant => ({kind: "string", value, stringId: 0});
const number = (value: number): LuauConstant => ({kind: "number", value});
const field = (name: string, value: Expression): TableField => ({name, value});
function template(names: string[], values: Array<LuauConstant | undefined>) {
  const constants: LuauConstant[] = names.map(string);
  const entries = names.map((_name, key) => {
    const value = values[key];
    if (!value) return {key, value: -1};
    const index = constants.length;
    constants.push(value);
    return {key, value: index};
  });
  return {constants, shape: {kind: "tableWithConstants", entries} as LuauConstant};
}

it("restores a preloaded constant between two untouched runtime values", () => {
  const {constants, shape} = template(["early", "marker", "late"], [undefined, number(7), undefined]);
  const early = field("early", ident("left")), marker = field("marker", lit(7)), late = field("late", ident("right"));
  const fields = [marker, early, late];
  expect(restoreTemplateFieldOrder(fields, shape, constants)).toEqual([early, marker, late]);
  expect(fields).toEqual([marker, early, late]);
});

it.each([null, true, false, "text", -0, 1 / 0])("uses exact preloaded primitive %s", value => {
  const constant: LuauConstant = value === null ? {kind: "nil"}
    : typeof value === "string" ? string(value) : typeof value === "boolean" ? {kind: "boolean", value} : number(value);
  const {constants, shape} = template(["runtime", "constant"], [undefined, constant]);
  const runtime = field("runtime", ident("value")), constantField = field("constant", lit(value));
  expect(restoreTemplateFieldOrder([constantField, runtime], shape, constants)).toEqual([runtime, constantField]);
});

it.each([1, -0, NaN])("does not treat a different or unproved numeric value %s as movable", value => {
  const {constants, shape} = template(["constant", "runtime"], [number(value === 1 ? 2 : value === 0 ? 0 : NaN), undefined]);
  const fields = [field("runtime", ident("value")), field("constant", lit(value))];
  expect(restoreTemplateFieldOrder(fields, shape, constants)).toBe(fields);
});

it("does not move ordinary literal stores without preload evidence", () => {
  const {constants, shape} = template(["early", "marker", "late"], [undefined, number(7), undefined]);
  const fields = [field("marker", lit(7)), field("late", lit(2)), field("early", lit(1))];
  expect(restoreTemplateFieldOrder(fields, shape, constants)).toBe(fields);
});

it.each(["call", "property", "function-expr", "table"] as const)("retains relative order around %s values", kind => {
  const runtime: Expression = kind === "call" ? {kind, callee: ident("effect"), args: [], open: false}
    : kind === "property" ? {kind, object: ident("owner"), name: "value"}
    : kind === "table" ? {kind, fields: []}
    : {kind, params: [], isVararg: false, body: block([]), debugName: "early"};
  const {constants, shape} = template(["early", "marker", "late"], [undefined, number(7), undefined]);
  const early = field("early", runtime), marker = field("marker", lit(7)), late = field("late", ident("other"));
  const accepted = restoreTemplateFieldOrder([marker, early, late], shape, constants);
  expect(accepted).toEqual([early, marker, late]);
  expect(accepted[0]!.value).toBe(runtime);
  const reversed = [marker, late, early];
  expect(restoreTemplateFieldOrder(reversed, shape, constants)).toBe(reversed);
});

it.each(["anonymous", "renamed"])("retains the spelling of a %s direct function field", debugName => {
  const {constants, shape} = template(["callback", "marker"], [undefined, number(7)]);
  const fields = [field("marker", lit(7)), field("callback", {kind: "function-expr", params: [],
    isVararg: false, body: block([]), debugName: debugName === "anonymous" ? "" : "other"})];
  expect(restoreTemplateFieldOrder(fields, shape, constants)).toBe(fields);
});

it.each(["missing", "extra", "duplicate", "list", "computed", "bracketed"])("declines an incomplete or altered %s constructor", change => {
  const {constants, shape} = template(["runtime", "marker"], [undefined, number(7)]);
  const fields = [field("marker", lit(7)), field("runtime", ident("value"))];
  if (change === "missing") fields.pop();
  if (change === "extra") fields.push(field("other", lit(1)));
  if (change === "duplicate") fields[1] = field("marker", ident("value"));
  if (change === "list") fields[1] = {list: true, value: ident("value")};
  if (change === "computed") fields[1] = {key: ident("key"), value: ident("value")};
  if (change === "bracketed") fields[1] = {key: lit("runtime"), value: ident("value")};
  expect(restoreTemplateFieldOrder(fields, shape, constants)).toBe(fields);
});

it.each(["", "end", "two words"])("does not claim a record template for key %s", name => {
  const {constants, shape} = template([name, "marker"], [undefined, number(7)]);
  const fields = [field("marker", lit(7)), field(name, ident("value"))];
  expect(restoreTemplateFieldOrder(fields, shape, constants)).toBe(fields);
});

it("rejects duplicate template keys, oversized templates and non-template allocations", () => {
  const fields = [field("marker", lit(7)), field("runtime", ident("value"))];
  const duplicate = template(["runtime", "runtime"], [undefined, number(7)]);
  expect(restoreTemplateFieldOrder(fields, duplicate.shape, duplicate.constants)).toBe(fields);
  const names = Array.from({length: 33}, (_value, index) => `field${index}`);
  const large = template(names, names.map(() => number(7)));
  const largeFields = names.map(name => field(name, lit(7))).reverse();
  expect(restoreTemplateFieldOrder(largeFields, large.shape, large.constants)).toBe(largeFields);
  expect(restoreTemplateFieldOrder(fields, undefined, [])).toBe(fields);
  expect(restoreTemplateFieldOrder(fields, {kind: "table", keys: [0, 1]}, [string("runtime"), string("marker")])).toBe(fields);
});

it("pins both official compiler inputs and reconstructs every authored profile", () => {
  const base = new URL("./fixtures/template-field-order/", import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL("manifest.json", base), "utf8")) as {
    sources: Array<{path: string; sha256: string}>;
    inputs: Array<{path: string; sha256: string; source: string; profile: string}>;
  };
  expect(manifest.sources).toHaveLength(2);
  expect(manifest.inputs).toHaveLength(24);
  for (const item of [...manifest.sources, ...manifest.inputs])
    expect(createHash("sha256").update(readFileSync(new URL(item.path, base))).digest("hex")).toBe(item.sha256);
  for (const item of manifest.inputs) {
    const result = decompile(readFileSync(new URL(item.path, base)), {opcodeEncoding: "official", runtimeContext: false});
    if (!result.ok) throw new Error(item.path + ": " + result.error);
    expect(result.validation).toEqual([]);
    if (item.source === "template-layout.luau") expect(result.source).toMatch(/\{ ready = [^,]+, beta = 8 \}/);
  }
});
