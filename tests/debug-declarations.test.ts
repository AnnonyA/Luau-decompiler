import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { analyzeBindings } from "../src/analysis/Bindings.ts";
import { block, chunk, ident, lit, type Expression, type LocalDeclaration, type Statement } from "../src/ast/Ast.ts";
import { decompile } from "../src/decompile.ts";
import { printLuau } from "../src/print/LuauPrinter.ts";
import { groupDebugDeclarations } from "../src/reconstruct/DebugDeclarations.ts";

const fixtureBase = new URL("./fixtures/debug-declarations/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", fixtureBase), "utf8")) as {
  sources: Array<{name: string; sourceSha256: string; bytecodes: Array<{profile: string; path: string; sha256: string}>}>;
};
const call = (name: string, args: Expression[] = []): Expression => ({kind: "call", callee: ident(name), args, open: false});
const local = (name: string, value: Expression, register: number, startPc = 4): LocalDeclaration => ({
  kind: "local", names: [name], values: [value],
  debugDeclaration: {prototypeId: 0, startPc, endPc: 20, register},
});
const output = (statements: Statement[]): string => printLuau(chunk(groupDebugDeclarations(block(statements)).statements));

describe("parallel declarations from bytecode debug scopes", () => {
  it("restores every name after independent scalar producers, including a captured loop cell", () => {
    const entry = manifest.sources.find(source => source.name === "parallel-initializers")!;
    const fixture = entry.bytecodes.find(bytecode => bytecode.profile === "O0g2")!;
    const source = readFileSync(new URL(`${entry.name}.luau`, fixtureBase));
    const bytecode = readFileSync(new URL(fixture.path, fixtureBase));
    expect(createHash("sha256").update(source).digest("hex")).toBe(entry.sourceSha256);
    expect(createHash("sha256").update(bytecode).digest("hex")).toBe(fixture.sha256);
    const result = decompile(bytecode, {opcodeEncoding: "official", typeAnnotations: "off"});
    if (!result.ok) throw new Error(result.error);
    expect(result.validation).toEqual([]);
    expect(result.source).toContain("local left, right = ");
    expect(result.source).toContain("local first, second, third = 7, 11, 13");
    expect(result.source).toMatch(/local a, b = (\w+), \1 \* 2/);
    const a = analyzeBindings(result.ast.body).bindings.find(binding => binding.name === "a");
    expect(a?.captured).toBe(true);
    expect(a?.writes).toHaveLength(1);
  });

  it.each([1, 2])("does not assign a deleted local's name to an older temporary at O%s", level => {
    const bytes = readFileSync(new URL(`parallel-initializers-O${level}g2.luauc`, fixtureBase));
    const result = decompile(bytes, {opcodeEncoding: "official", typeAnnotations: "off"});
    if (!result.ok) throw new Error(result.error);
    expect(result.validation).toEqual([]);
    expect(result.source).not.toMatch(/local first, second, third = print/);
    expect(result.source).not.toMatch(/local marker, other = print/);
    expect(result.source).toContain('print(nil, nil)');
  });

  it("keeps the order and scalar arity of adjacent effectful initializers", () => {
    expect(output([local("a", call("first"), 0), local("b", call("second"), 1)]))
      .toBe("local a, b = first(), second()\n");
  });

  it("keeps an earlier declaration visible to a later read or closure capture", () => {
    for (const value of [ident("a"), {kind: "function-expr", params: [], isVararg: false,
      body: block([{kind: "return", values: [ident("a")]}])}] as Expression[]) {
      const result = groupDebugDeclarations(block([local("a", call("first"), 0), local("b", value, 1),
        {kind: "return", values: [ident("b")]}]));
      expect(result.statements).toHaveLength(3);
      expect(analyzeBindings(result).globals.has("a")).toBe(false);
    }
  });

  it("does not join independent debug scopes or nonconsecutive result registers", () => {
    for (const next of [local("b", call("second"), 2), local("b", call("second"), 1, 5)]) {
      expect(output([local("a", call("first"), 0), next])).toBe("local a = first()\nlocal b = second()\n");
    }
  });

  it("gives a complete one-use tuple its source names without a second tuple or lost nil slot", () => {
    const producer: LocalDeclaration = {kind: "local", names: ["tmp", "tmp2", "tmp3"], values: [call("many")]};
    const result = output([producer, local("a", ident("tmp"), 0), local("b", ident("tmp2"), 1),
      local("c", ident("tmp3"), 2), {kind: "return", values: [ident("a"), ident("b"), ident("c")]}]);
    expect(result).toBe("local a, b, c = many()\nreturn a, b, c\n");
  });

  it("keeps tuples with another reader, a captured cell, or a clipped copy", () => {
    const producer: LocalDeclaration = {kind: "local", names: ["tmp", "tmp2", "tmp3"], values: [call("many")]};
    const full: Statement[] = [local("a", ident("tmp"), 0), local("b", ident("tmp2"), 1), local("c", ident("tmp3"), 2)];
    const observations: Statement[] = [
      {kind: "return", values: [ident("tmp")]},
      {kind: "return", values: [{kind: "function-expr", params: [], isVararg: false,
        body: block([{kind: "return", values: [ident("tmp2")]}])}]},
    ];
    for (const observation of observations) expect(output([producer, ...full, observation])).toContain("local tmp, tmp2, tmp3 = many()");
    expect(output([producer, ...full.slice(0, 2), {kind: "return", values: [ident("a"), ident("b")]}]))
      .toContain("local tmp, tmp2, tmp3 = many()");
  });
});
