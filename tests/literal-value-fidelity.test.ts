import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { chunk, lit } from "../src/ast/Ast.ts";
import { decompile } from "../src/decompile.ts";
import { constantAsLuauLiteral } from "../src/decode/Constant.ts";
import { writeBytecode } from "../src/decode/BytecodeWriter.ts";
import { printLuau } from "../src/print/LuauPrinter.ts";
import { typeFromExpression } from "../src/reconstruct/RobloxSemantics.ts";
import { abc, ad, Opcode, proto } from "./helpers.ts";

const fixtureRoot = new URL("./fixtures/literal-fidelity/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", fixtureRoot), "utf8")) as {
  profiles: Array<{ id: string; source: string; sourceSha256: string; bytecode: string; sha256: string; bytecodeVersion: number }>;
};
const returned = (value: bigint) => printLuau(chunk([{ kind: "return", values: [lit(value)] }]));

describe("literal value fidelity", () => {
  it.each([
    [0n, "0i"],
    [-1n, "-1i"],
    [9007199254740993n, "9007199254740993i"],
    [(1n << 63n) - 1n, "9223372036854775807i"],
    [-(1n << 63n), "0x8000000000000000i"],
  ] as const)("preserves integer type and bits for %s", (value, spelling) => {
    expect(returned(value)).toBe(`return ${spelling}\n`);
    expect(constantAsLuauLiteral({ kind: "integer", value })).toBe(spelling);
    expect(typeFromExpression(lit(value))).toBe("integer");
  });

  it("keeps unary minus and power precedence for integer literals", () => {
    expect(printLuau(chunk([{ kind: "return", values: [
      { kind: "binary", op: "^", left: lit(-2n), right: lit(2n) },
      { kind: "unary", op: "-", argument: lit(-1n) },
    ] }]))).toBe("return (-2i) ^ 2i, -(-1i)\n");
  });

  it.each(manifest.profiles)("keeps sealed bytecode and source evidence for $id", profile => {
    const bytes = readFileSync(new URL(profile.bytecode, fixtureRoot));
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(profile.sha256);
    expect(createHash("sha256").update(readFileSync(new URL(profile.source, fixtureRoot))).digest("hex")).toBe(profile.sourceSha256);
    const result = decompile(bytes, { opcodeEncoding: "official", runtimeContext: false });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.module.version).toBe(profile.bytecodeVersion);
    expect(result.validation).toEqual([]);
    if (profile.id.startsWith("integer64/")) {
      expect(result.source).toContain("9007199254740993i");
      expect(result.source).toContain("9007199254740992i");
      expect(result.source).not.toMatch(/local (?:high|low): number/);
    }
    if (profile.id === "vector-w/api/O2") {
      expect(result.source).toContain("vector.create(1, 2, 3, 4)");
      expect(result.disassembly).toContain("vector 1,2,3,4");
    }
    if (profile.id.startsWith("vector-") && profile.id.endsWith("/O2")) {
      expect(result.diagnostics).toContainEqual(expect.objectContaining({
        severity: "warning", code: "vector-constructor-assumption",
      }));
    } else {
      expect(result.diagnostics.filter(item => item.code === "vector-constructor-assumption")).toEqual([]);
    }
  });

  it("retains all four precise wire components without claiming the host precision", () => {
    const value = { kind: "vector" as const, x: 1.0000000000000002, y: -0, z: 3, w: 16777217, precise: true };
    const bytes = writeBytecode(proto({
      constants: [value],
      instructions: [ad(Opcode.LOADK, 0, 0), abc(Opcode.RETURN, 0, 2, 0)],
    }), { version: 13, typesVersion: 1 });
    const result = decompile(bytes, { opcodeEncoding: "official" });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.source).toBe("return (vector.create(1.0000000000000002, -0, 3, 16777217))\n");
    expect(constantAsLuauLiteral(value)).toBe("vector.create(1.0000000000000002, -0, 3, 16777217)");
    expect(result.disassembly).toContain("vector64 1.0000000000000002,0,3,16777217");
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      severity: "warning", code: "vector-constructor-assumption", prototypeId: 0, pc: 0,
      message: expect.stringContaining("64-bit vector constant"),
    }));
  });

  it("does not imply that a replaced constructor has been repaired", () => {
    const result = decompile(readFileSync(new URL("vector-constructor-replaced-api-O2.luauc", fixtureRoot)), {
      opcodeEncoding: "official", runtimeContext: false,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.source).toContain("vector = {");
    expect(result.source).toContain("vector.create(1, 2, 3, 4)");
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: "vector-constructor-assumption", prototypeId: 1, pc: 9,
      message: expect.stringContaining("does not identify a callable constructor"),
    }));
  });
});
