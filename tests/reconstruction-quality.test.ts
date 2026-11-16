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

describe("closure presentation", () => {
  const source = decompileFixture("inline-callbacks");

  it("returns a single-use anonymous function to the call that receives it", () => {
    expect(source).toMatch(/InputBegan:Connect\(function\(input: InputObject, gameProcessedEvent: boolean\)/);
    expect(source).toMatch(/PreAnimation:Connect\(function\(\)/);
    expect(source).toMatch(/task\.delay\(1, function\(\)/);
    expect(source).toMatch(/task\.spawn\(function\(\)/);
    expect(source).not.toMatch(/local function on[A-Z]/);
    expect(source).not.toMatch(/\b(?:spawned|delayed)\b/);
  });

  it("declares named functions with `local function`, never a split declaration", () => {
    expect(source).toContain("local function setSprinting(");
    expect(source).toContain("local function track(");
    expect(source).not.toMatch(/^\s*local \w+\n\s*function /m);
  });

  it("captures a runtime value through an ordinary local", () => {
    expect(source).toMatch(/local camPart = \w+\.RootPart\.CamPart/);
    expect(source).not.toMatch(/\bcaptured\d*\b/);
    expect(source).not.toMatch(/^\s*do$/m);
  });
});

describe("generic-for loop variables", () => {
  it("does not merge a body temporary with a later loop's variables", () => {
    const source = decompileFixture("generic-loop-scratch");
    expect(source).toMatch(/for _, (\w+) in \w+ do\n\s+\1\.Parent = nil\n\s+end/);
    expect(source).not.toMatch(/^\s*local \w+$/m);
  });
});

describe("stores after a nested constructor", () => {
  it("keeps writes through a register that previously held a nested literal", () => {
    const source = decompileFixture("nested-constructor-store");
    expect(source).toMatch(/\.max \*= 2/);
    expect(source).toMatch(/\[#\w+\.tags \+ 1\] = "d"/);
  });
});
