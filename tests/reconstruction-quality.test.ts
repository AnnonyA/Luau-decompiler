import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decompile } from "../src/decompile.ts";

/** Fixtures are project-authored Luau compiled with the official compiler
 * (`luau-compile --binary -O<n> -g1`); the source sits beside each chunk. */
function decompileFixture(name: string): string {
  const bytes = readFileSync(new URL(`./fixtures/quality/${name}.luauc`, import.meta.url));
  const result = decompile(new Uint8Array(bytes), { opcodeEncoding: "official" });
  if (!result.ok) throw new Error(result.error);
  return result.source;
}

describe("stores after a nested constructor", () => {
  it("keeps writes through a register that previously held a nested literal", () => {
    const source = decompileFixture("nested-constructor-store");
    expect(source).toMatch(/\.max \*= 2/);
    expect(source).toMatch(/\[#\w+\.tags \+ 1\] = "d"/);
  });
});
