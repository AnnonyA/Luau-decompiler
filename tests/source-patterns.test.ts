import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decompile } from "../src/decompile.ts";
import { decodeBytecode } from "../src/decode/Decoder.ts";

const fixture = (name: string): Uint8Array => readFileSync(new URL(name, import.meta.url));

function sourceFor(name: string): string {
  const result = decompile(fixture(name));
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(result.error);
  }
  expect(result.validation).toEqual([]);
  expect(result.source).not.toMatch(/^\s*--/m);
  return result.source;
}

describe("real bytecode source patterns", () => {
  it("keeps the official fixture byte-exact and reconstructs numeric-for continue", () => {
    const bytes = fixture("luac.bin");
    const hash = createHash("sha1")
      .update(`blob ${bytes.byteLength}\0`)
      .update(bytes)
      .digest("hex");

    expect(bytes.byteLength).toBe(22_980);
    expect(hash).toBe("8a942d62ce2a933f6ec5d84822a9420b263f6b30");

    const source = sourceFor("luac.bin");
    expect(source).toMatch(/for \w+ = 1, \w+(?:, \w+)? do\n\s+if .*% 2 == 0 then\n\s+continue/);
    expect(source).toContain("local Players: Players = game:GetService(\"Players\")");
    expect(source.length).toBeLessThan(100_000);
  });

  it("normalizes Roblox opcodes and recovers the IndexUI service/module chain", () => {
    const bytes = fixture("IndexUI_ModuleScript_Bytecode.txt");
    const decoded = decodeBytecode(bytes);
    expect(bytes.byteLength).toBe(32_531);
    expect(decoded.profile.notes).toContain("Roblox opcode encoding was detected and normalized");
    expect(decoded.profile.notes).toContain("Roblox bytecode trailer was recognized as opaque metadata");

    const source = sourceFor("IndexUI_ModuleScript_Bytecode.txt");
    expect(source).toContain("local Players: Players = game:GetService(\"Players\")");
    expect(source).toContain("local Nukes: Instance = ReplicatedStorage:WaitForChild(\"Nukes\")");
    expect(source).toContain("local FramesManager = require(script.Parent.FramesManager)");
    expect(source.length).toBeLessThan(100_000);
  });

  it("decompiles the real Military controller without duplicated CFG regions", () => {
    const bytes = fixture("MilitaryMeltdownController_ModuleScript_Bytecode.txt");
    expect(bytes.byteLength).toBe(13_604);

    const source = sourceFor("MilitaryMeltdownController_ModuleScript_Bytecode.txt");
    expect(source).toContain("local Players: Players = game:GetService(\"Players\")");
    expect(source).toContain("local SoundService: SoundService = game:GetService(\"SoundService\")");
    expect(source).toContain("local Remotes = require(packages.Remotes)");
    expect(source.length).toBeLessThan(50_000);
  });
});
