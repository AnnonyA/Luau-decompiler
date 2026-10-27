import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decompile } from "../src/decompile.ts";

function sourceFor(name: string, optimization: number): string {
  const result = decompile(readFileSync(new URL(`./fixtures/object-optimized/${name}-O${optimization}.luauc`, import.meta.url)), {
    opcodeEncoding: "official",
  });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error);
  expect(result.validation).toEqual([]);
  return result.source;
}

describe.each([0, 1, 2])("official object and optimized fixtures at O%i", optimization => {
  it("preserves one closure shared by module fields", () => {
    const source = sourceFor("method-alias", optimization);
    expect(source.match(/\bfunction\b/g)).toHaveLength(1);
    expect(source).toContain("primary = method");
    expect(source).toContain("alias = method");
  });

  it("keeps a replacement __index after the module self reference", () => {
    const source = sourceFor("metatable-overwrite", optimization);
    const selfReference = source.indexOf("module.__index = module");
    const replacement = source.search(/(?:fallback|\["fallback"\]) = 7/);
    expect(selfReference).toBeGreaterThanOrEqual(0);
    expect(replacement).toBeGreaterThan(selfReference);
  });

  it("preserves overwrites of named, numeric, and computed self references", () => {
    const source = sourceFor("self-reference-overwrite", optimization);
    expect(source).toMatch(/\.self = 9/);
    expect(source).toMatch(/\[1\] = 11/);
    expect(source).toMatch(/\[\w+\] = 13/);
  });

  it("retains metatable constructors and method aliases", () => {
    const source = sourceFor("metatable-constructor", optimization);
    expect(source).toContain("setmetatable(");
    expect(source).toContain(".__index =");
    expect(source).toMatch(/\.alias = \w+\.read/);
  });

  it("reconstructs branches after optimized function inlining", () => {
    const source = sourceFor("inlined-registers", optimization);
    expect(source).toContain("print(");
    expect(source).not.toMatch(/\br\d+\b/);
  });
});
