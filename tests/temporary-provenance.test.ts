import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { block, chunk, ident, lit, type Expression, type LocalDeclaration, type Statement } from "../src/ast/Ast.ts";
import { foldTemporaries, type TempFoldingOptions } from "../src/ast/TempFolding.ts";
import { decompile } from "../src/decompile.ts";
import { decodeBytecode } from "../src/decode/Decoder.ts";
import { normalizeControlFlow } from "../src/decode/NormalizeControlFlow.ts";
import { printLuau } from "../src/print/LuauPrinter.ts";
import { reconstructFunction } from "../src/reconstruct/Reconstructor.ts";

const call = (name: string, args: Expression[] = []): Expression => ({kind: "call", callee: ident(name), args, open: false});
const property = (object: string, name: string): Expression => ({kind: "property", object: ident(object), name});
const temporary = (name: string, value: Expression): LocalDeclaration => ({kind: "local", names: [name], values: [value],
  definition: {prototypeId: 1, pc: 4, register: 2}});
const output = (statements: Statement[], options: TempFoldingOptions = {}): string =>
  printLuau(foldTemporaries(chunk(statements), options));
const unrelatedDebug: TempFoldingOptions = {
  debugNames: new Set(["kind", "offset"]),
  inferredSourceNames: new Set(["kind"]),
  declarationNamesByPrototype: new Map([[1, new Set<string>()], [2, new Set(["kind", "offset"])]]),
};

describe("temporary producer ownership", () => {
  const condition = (): Statement => ({kind: "if", test: {kind: "binary", op: "==", left: ident("kind"), right: property("value", "kind")},
    consequent: block([{kind: "return", values: [lit(true)]}]), branches: []});

  it("does not treat another function's debug spelling as a declaration", () => {
    expect(output([temporary("kind", property("schema", "kind")), condition()], unrelatedDebug))
      .toBe("if schema.kind == value.kind then\n    return true\nend\n");
  });

  it.each(["explicit", "same-prototype", "exact-debug", "unknown-origin", "unknown-prototype"])
    ("keeps source protection for %s evidence", evidence => {
      const declaration = temporary("kind", property("schema", "kind"));
      const options: TempFoldingOptions = {...unrelatedDebug};
      if (evidence === "explicit") options.sourceNames = new Set(["kind"]);
      if (evidence === "same-prototype") options.declarationNamesByPrototype = new Map([[1, new Set(["kind"])]]);
      if (evidence === "exact-debug") declaration.definition!.debugName = "originalSpelling";
      if (evidence === "unknown-origin") delete declaration.definition;
      if (evidence === "unknown-prototype") declaration.definition!.prototypeId = 9;
      expect(output([declaration, condition()], options)).toContain("local kind = schema.kind");
    });

  it("uses the same ownership rule when propagating a literal across a statement", () => {
    const statements: Statement[] = [temporary("offset", lit(4)), {kind: "expression-stmt", expression: call("observe")},
      {kind: "return", values: [{kind: "binary", op: "+", left: ident("x"), right: ident("offset")}]}];
    expect(output(statements, unrelatedDebug)).toBe("observe()\nreturn x + 4\n");
    expect(output(statements, {...unrelatedDebug, sourceNames: new Set(["offset"])})).toContain("local offset = 4");
  });

  it("keeps captured cells and writes even when the debug spelling belongs elsewhere", () => {
    const reader: Expression = {kind: "function-expr", params: [], isVararg: false,
      body: block([{kind: "return", values: [ident("kind")]}])};
    expect(output([temporary("kind", property("schema", "kind")), {kind: "return", values: [reader]}], unrelatedDebug))
      .toContain("local kind = schema.kind");
    expect(output([temporary("kind", property("schema", "kind")),
      {kind: "assign", targets: [ident("kind")], values: [call("mutate")]}, condition()], unrelatedDebug))
      .toContain("local kind = schema.kind");
  });

  it("does not delay a property read past an earlier effect or into a conditional arm", () => {
    const consumers: Statement[] = [
      {kind: "return", values: [call("observe", [call("first"), ident("kind")])]},
      {kind: "return", values: [{kind: "binary", op: "and", left: ident("enabled"), right: ident("kind")}]},
      {kind: "return", values: [{kind: "if-expr", test: ident("enabled"), consequent: ident("kind"), branches: [], alternate: lit(false)}]},
    ];
    for (const consumer of consumers) expect(output([temporary("kind", property("schema", "kind")), consumer], unrelatedDebug))
      .toContain("local kind = schema.kind");
  });
});

describe("scalar temporary adjustment in expression lists", () => {
  const consumers: Array<[string, () => Statement, string]> = [
    ["return", () => ({kind: "return", values: [lit(0), ident("temp")]}), "return 0, (many())\n"],
    ["argument", () => ({kind: "expression-stmt", expression: call("observe", [lit(0), ident("temp")])}), "observe(0, (many()))\n"],
    ["table", () => ({kind: "return", values: [{kind: "table", fields: [{value: lit(0)}, {value: ident("temp")}]}]}), "return { 0, (many()) }\n"],
    ["declaration", () => ({kind: "local", names: ["a", "b"], values: [ident("temp")]}), "local a, b = (many())\n"],
    ["assignment", () => ({kind: "assign", targets: [ident("a"), ident("b")], values: [ident("temp")]}), "a, b = (many())\n"],
    ["iterator", () => ({kind: "generic-for", names: ["key"], iterators: [ident("temp")], body: block([])}), "for key in (many()) do\nend\n"],
  ];

  it.each(consumers)("retains one result in the %s tail", (_label, consumer, expected) => {
    expect(output([temporary("temp", call("many")), consumer()])).toBe(expected);
  });

  it.each(["call", "method-call", "vararg"])("retains the scalar adjustment for a %s", kind => {
    const value: Expression = kind === "call" ? call("many") : kind === "method-call"
      ? {kind: "method-call", object: ident("provider"), name: "many", args: [], open: false} : {kind: "vararg"};
    const result = foldTemporaries(chunk([temporary("temp", value), {kind: "return", values: [lit(0), ident("temp")]}]));
    expect(result.body.statements).toEqual([{kind: "return", values: [lit(0), {kind: "paren", expression: value}]}]);
  });

  it("does not add a redundant adjustment to a non-tail scalar context", () => {
    expect(output([temporary("temp", call("many")), {kind: "expression-stmt", expression: call("observe", [ident("temp"), lit(0)])}]))
      .toBe("observe(many(), 0)\n");
  });

  it("retains unknown local declarations and explicit source declarations in added list-tail positions", () => {
    const declaration = temporary("temp", call("many"));
    const consumer: Statement = {kind: "expression-stmt", expression: call("observe", [ident("temp")])};
    expect(output([declaration, consumer], {sourceNames: new Set(["temp"])})).toContain("local temp = many()");
    delete declaration.definition;
    expect(output([declaration, consumer])).toContain("local temp = many()");
  });

  it("leaves an original open result pack open", () => {
    expect(output([{kind: "expression-stmt", expression: call("observe", [call("many")])}])).toBe("observe(many())\n");
  });

  it.each([lit(null), lit(Number.NaN), ident("possiblyNil")])("keeps a temporary ahead of a constructor key that may fail: %o", key => {
    const consumer: Statement = {kind: "return", values: [{kind: "table", fields: [
      {key, value: lit(0)}, {value: ident("temp")},
    ]}]};
    expect(output([temporary("temp", call("many")), consumer])).toContain("local temp = many()");
  });
});

describe("sealed temporary reconstruction fixtures", () => {
  const base = new URL("./fixtures/temporary-provenance/", import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL("manifest.json", base), "utf8")) as {
    sources: Array<{name: string; sourceSha256: string; bytecodes: Array<{profile: string; path: string; sha256: string}>}>;
  };
  it("folds a bytecode temporary despite a debug parameter in an unrelated function", () => {
    const result = decompile(readFileSync(new URL("cross-prototype-parameter-O0g2.luauc", base)), {opcodeEncoding: "official", typeAnnotations: "off"});
    if (!result.ok) throw new Error(result.error);
    expect(result.source).toContain("schema.kind == value.kind");
    expect(result.source).not.toContain("local kind = schema.kind");
  });

  it.each(["O2g1", "O2g2", "O2g1+x3", "O2g2+x1"])
    ("retains a dead guard-prelude field read when the selection reuses its register: %s", profile => {
      const decoded = decodeBytecode(readFileSync(new URL(`debug-collision-order-${profile}.luauc`, base)), {opcodeEncoding: "official"});
      const module = normalizeControlFlow(decoded.module);
      const reconstructed = reconstructFunction(module, module.prototypes[module.mainProtoId]!);
      const reads = (node: unknown): number => {
        if (node === null || typeof node !== "object") return 0;
        if (Array.isArray(node)) return node.reduce((total, child) => total + reads(child), 0);
        const value = node as {kind?: string; name?: string};
        if (value.kind === "function-expr" || value.kind === "function-decl") return 0;
        return (value.kind === "property" && value.name === "kind" ? 1 : 0) + Object.values(node).reduce<number>((total, child) => total + reads(child), 0);
      };
      // Four reads in two comparisons, one unconditional prelude of a false
      // inlined call, two in the true call, and one captured mutable cell.
      expect(reads(reconstructed.body)).toBe(8);
    });

  it("pins independent effect/arity sources and every normal/Hard input", () => {
    for (const source of manifest.sources) {
      expect(createHash("sha256").update(readFileSync(new URL(`${source.name}.luau`, base))).digest("hex")).toBe(source.sourceSha256);
      expect(source.bytecodes).toHaveLength(12);
      for (const bytecode of source.bytecodes) {
        const bytes = readFileSync(new URL(bytecode.path, base));
        expect(createHash("sha256").update(bytes).digest("hex")).toBe(bytecode.sha256);
        const result = decompile(bytes, {opcodeEncoding: "official", typeAnnotations: "off"});
        if (!result.ok) throw new Error(`${source.name}/${bytecode.profile}: ${result.error}`);
        expect(result.validation).toEqual([]);
      }
    }
  });
});
