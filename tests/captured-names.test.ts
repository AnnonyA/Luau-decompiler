import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decompile } from "../src/decompile.ts";

const fixture = (name: string): Uint8Array => readFileSync(new URL(name, import.meta.url));

describe("captured local naming", () => {
  it("keeps connectionStress count and connection as distinct captured locals", () => {
    const result = decompile(fixture("luac.bin"));
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error);
    }

    const section = result.source.match(
      /(?:local function connectionStress|connectionStress = function)[\s\S]*?(?=\nlocal function collectionStress|\nlocal collectionStress)/,
    )?.[0];

    expect(section).toBeDefined();
    expect(section).toMatch(/local count(?:: [^=]+)?\s*=\s*0/);
    expect(section).toMatch(/count \+= select\("#", \.\.\.\)/);
    expect(section).toMatch(/local connection(?:: [^=]+)?\s*=\s*nil/);
    expect(section).toMatch(/connection:Disconnect\(\)/);
    expect(section).not.toMatch(/local count\s*=\s*function/);
  });
});
