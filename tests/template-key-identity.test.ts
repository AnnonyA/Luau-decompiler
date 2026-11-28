import { expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { decompile } from "../src/decompile.ts";
import { type Expression, type TableExpression } from "../src/ast/Ast.ts";
import { abc, ad, compile, Opcode, proto, strings } from "./helpers.ts";

const decode = (instructions: number[], template = false) => {
  const result = decompile(compile(proto({
    constants: [...strings("ready", "other", "effect", "object", "key"), {kind: "table", keys: [0]}],
    instructions: [...(template ? [ad(Opcode.DUPTABLE, 0, 5)] : [abc(Opcode.NEWTABLE, 0, 1, 0), 0]),
      ...instructions, abc(Opcode.RETURN, 0, 2, 0)],
  })), {opcodeEncoding: "official"});
  if (!result.ok) throw new Error(result.error);
  expect(result.validation).toEqual([]);
  const tables: TableExpression[] = [];
  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    if ((node as Expression).kind === "table") tables.push(node as TableExpression);
    Object.values(node).forEach(visit);
  };
  visit(result.ast);
  expect(tables.length).toBeGreaterThan(0);
  return {result, fields: tables[0]!.fields};
};
const store = (kind: "name" | "key", key = 0): number[] => kind === "name"
  ? [abc(Opcode.SETTABLEKS, 2, 0, 0), key]
  : [ad(Opcode.LOADK, 1, key), abc(Opcode.SETTABLE, 2, 0, 1)];

it.each(["name-key", "key-name"] as const)("retains ordinary %s writes without a one-slot allocation proof", direction => {
  const [first, second] = direction.split("-") as ["name" | "key", "name" | "key"];
  const {fields} = decode([ad(Opcode.LOADN, 2, 1), ...store(first), ad(Opcode.LOADN, 2, 5), ...store(second)]);
  expect(fields).toEqual([
    {...(first === "name" ? {name: "ready"} : {key: {kind: "literal", value: "ready"}}), value: {kind: "literal", value: 1}},
    {...(second === "name" ? {name: "ready"} : {key: {kind: "literal", value: "ready"}}), value: {kind: "literal", value: 5}},
  ]);
});

it.each(["name", "key"] as const)("consumes the one loader reservation before a final %s store", second => {
  const first = second === "name" ? [ad(Opcode.LOADN, 2, 0), ...store("key")] : [];
  const {fields} = decode([...first, ad(Opcode.LOADN, 2, 5), ...store(second)], true);
  expect(fields).toEqual([{...(second === "name" ? {name: "ready"} : {key: {kind: "literal", value: "ready"}}),
    value: {kind: "literal", value: 5}}]);
});

it("retains a different key beside the original reservation", () => {
  const {fields} = decode([ad(Opcode.LOADN, 2, 5), ...store("key", 1)], true);
  expect(fields).toEqual([{name: "ready", value: {kind: "literal", value: 0}},
    {key: {kind: "literal", value: "other"}, value: {kind: "literal", value: 5}}]);
});

it("does not consume a later nonzero literal as if it were the loader reservation", () => {
  const {fields} = decode([ad(Opcode.LOADN, 2, 1), ...store("name"), ad(Opcode.LOADN, 2, 5), ...store("key")], true);
  expect(fields).toHaveLength(2);
  expect(fields.map(field => field.value)).toEqual([{kind: "literal", value: 1}, {kind: "literal", value: 5}]);
});

it("keeps the zero write after another field has joined the table", () => {
  const {fields} = decode([ad(Opcode.LOADN, 2, 8), ...store("name", 1), ad(Opcode.LOADN, 2, 5), ...store("key")], true);
  expect(fields).toHaveLength(3);
  expect(fields[0]).toMatchObject({name: "ready", value: {kind: "literal", value: 0}});
  expect(fields[2]).toEqual({key: {kind: "literal", value: "ready"}, value: {kind: "literal", value: 5}});
});

it("keeps the reservation when a nested field has already joined the pending table", () => {
  const {fields} = decode([abc(Opcode.NEWTABLE, 2, 0, 0), 0, ...store("name", 1),
    ad(Opcode.LOADN, 2, 5), ...store("key")], true);
  expect(fields).toHaveLength(3);
  expect(fields[0]).toMatchObject({name: "ready", value: {kind: "literal", value: 0}});
  expect(fields.some(field => field.key?.kind === "literal" && field.key.value === "ready" &&
    field.value.kind === "literal" && field.value.value === 5)).toBe(true);
});

it("does not equate a dynamic string expression with a known field name", () => {
  const {fields} = decode([ad(Opcode.LOADN, 2, 5), abc(Opcode.GETGLOBAL, 1, 0, 0), 4,
    abc(Opcode.SETTABLE, 2, 0, 1)], true);
  expect(fields).toHaveLength(2);
  expect(fields[0]).toEqual({name: "ready", value: {kind: "literal", value: 0}});
  expect(fields[1]!.key).toEqual({kind: "identifier", name: "key"});
});

it.each(["call", "unary"])("keeps a prior %s when matching the mixed key spelling", effect => {
  const prior = effect === "call" ? [abc(Opcode.GETGLOBAL, 2, 0, 0), 2, abc(Opcode.CALL, 2, 1, 2)]
    : [abc(Opcode.GETGLOBAL, 2, 0, 0), 3, abc(Opcode.MINUS, 2, 2, 0)];
  const {result, fields} = decode([...prior, ...store("key"), ad(Opcode.LOADN, 2, 5), ...store("name")]);
  expect(fields).toHaveLength(2);
  expect(result.source).toContain(effect === "call" ? "effect()" : "-object");
});

it.each([["empty", ""], ["keyword", "end"]])("retains the named zero slot for a %s key", (name, key) => {
  const base = new URL("./fixtures/template-key-alias/", import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL("synthetic-keys.json", base), "utf8"));
  const entry = manifest.entries.find((item: {name: string}) => item.name === name);
  expect(entry.key).toBe(key);
  const bytes = readFileSync(new URL(entry.bytecode, base));
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(entry.sha256);
  const result = decompile(bytes, {opcodeEncoding: "official"});
  if (!result.ok) throw new Error(result.error);
  expect(result.validation).toEqual([]);
  expect(result.source).toContain(`[${JSON.stringify(key)}] = 0`);
  expect(result.source).toContain(`[${JSON.stringify(key)}] = 5`);
});

it.each(["template-key-alias", "template-key-captures"])("pins the independent %s closure and effect observations", folder => {
  const base = new URL("./fixtures/" + folder + "/", import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL("manifest.json", base), "utf8")) as {
    sources: Array<{name: string; sourceSha256: string; bytecodes: Array<{profile: string; path: string; sha256: string}>}>;
  };
  expect(manifest.sources).toHaveLength(1);
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
      if (entry.profile === "O1g2") {
        const tables: TableExpression[] = [];
        const visit = (node: unknown): void => {
          if (!node || typeof node !== "object") return;
          if ((node as Expression).kind === "table") tables.push(node as TableExpression);
          Object.values(node).forEach(visit);
        };
        visit(result.ast);
        expect(tables.some(table => table.fields.length === 2 &&
          table.fields[0]!.value.kind === "function-expr" && table.fields[0]!.value.debugName === "ready" &&
          (folder === "template-key-alias" ? table.fields[1]!.name === "ready" &&
            table.fields[1]!.value.kind === "function-expr" && table.fields[1]!.value.debugName === undefined
            : table.fields[1]!.key?.kind === "identifier" && table.fields[1]!.value.kind === "identifier"))).toBe(true);
      }
      if (folder === "template-key-alias" && entry.profile === "O2g2") {
        expect(result.source).toContain('["ready"] = function');
      }
    }
  }
});
