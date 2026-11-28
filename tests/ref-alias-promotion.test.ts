import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { analyzeBindings } from "../src/analysis/Bindings.ts";
import { decompile } from "../src/decompile.ts";
import type { Expression } from "../src/ast/Ast.ts";
import { abc, ad, compile, proto, CaptureType, Opcode } from "./helpers.ts";

it.each([1, 2])("keeps %s pre-capture register copies separate from the mutable cell", copies => {
  const bytes = compile(proto({maxStackSize: 6,
    children: [proto({maxStackSize: 1, numUpvalues: 1,
      instructions: [ad(Opcode.LOADN, 0, 7), abc(Opcode.SETUPVAL, 0, 0), abc(Opcode.RETURN, 0, 1)]})],
    instructions: [ad(Opcode.LOADN, 0, 4), abc(Opcode.MOVE, 1, 0),
      ...(copies === 2 ? [abc(Opcode.MOVE, 2, 1)] : []),
      ad(Opcode.NEWCLOSURE, 3, 0), abc(Opcode.CAPTURE, CaptureType.REF, 0),
      abc(Opcode.MOVE, 4, 3), abc(Opcode.CALL, 4, 1, 1), abc(Opcode.CLOSEUPVALS, 0),
      abc(Opcode.RETURN, 1, copies + 1)]}));
  const result = decompile(bytes, {opcodeEncoding: "official"});
  if (!result.ok) throw new Error(result.error);
  expect(result.validation).toEqual([]);
  const returned = result.ast.body.statements.at(-1);
  if (returned?.kind !== "return") throw new Error("missing return");
  expect(returned.values).toHaveLength(copies);
  const {bindings} = analyzeBindings(result.ast.body);
  const owner = (value: Expression) => bindings.find(binding => binding.reads.some(read => read.node === value));
  const mutable = bindings.find(binding => binding.captured && binding.writes.length > 0);
  expect(mutable).toBeDefined();
  for (const value of returned.values) {
    const saved = owner(value);
    expect(saved).toBeDefined();
    expect(saved).not.toBe(mutable);
    expect(saved!.writes).toHaveLength(0);
  }
});

it("keeps a copy made before the first REF capture across the original conditional call", () => {
  const base = new URL("./fixtures/ref-alias-promotion/", import.meta.url);
  const bytes = readFileSync(new URL("c875-rejected-state-O0g1.luauc", base));
  const result = decompile(bytes, {opcodeEncoding: "official"});
  if (!result.ok) throw new Error(result.error);
  const exercise = result.ast.body.statements.find(statement => statement.kind === "function-decl" && statement.name === "exercise");
  if (exercise?.kind !== "function-decl") throw new Error("missing exercise");
  const {bindings} = analyzeBindings(result.ast.body);
  const cell = bindings.find(binding => binding.scope === exercise.body && binding.captured && binding.writes.length > 0);
  expect(cell).toBeDefined();
  const saved = bindings.find(binding => binding.scope === exercise.body && binding.declaration.kind === "local" &&
    binding.declaration.values.some(value => cell!.reads.some(read => read.node === value)) && binding.reads.length > 1);
  expect(saved).toBeDefined();
  expect(saved!.writes).toHaveLength(0);
});

it("pins the authored sources and bytecodes from both real compiler revisions", () => {
  const base = new URL("./fixtures/ref-alias-promotion/", import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL("manifest.json", base), "utf8")) as {
    sources: Array<{path: string; sha256: string}>;
    inputs: Array<{path: string; sha256: string; pin: string; profile: string}>;
  };
  expect(manifest.sources).toHaveLength(3);
  expect(manifest.inputs).toHaveLength(36);
  for (const item of [...manifest.sources, ...manifest.inputs]) {
    expect(createHash("sha256").update(readFileSync(new URL(item.path, base))).digest("hex")).toBe(item.sha256);
  }
  for (const input of manifest.inputs) {
    const result = decompile(readFileSync(new URL(input.path, base)), {opcodeEncoding: "official"});
    if (!result.ok) throw new Error(input.path + ": " + result.error);
    expect(result.validation).toEqual([]);
  }
});
