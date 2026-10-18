import { describe, expect, it } from "vitest";
import { chunk, ident, lit } from "../src/ast/Ast.ts";
import { decompile } from "../src/decompile.ts";
import { printLuau } from "../src/print/LuauPrinter.ts";
import { abc, ad, compile, Opcode, proto, strings } from "./helpers.ts";

describe("table key fidelity", () => {
  it("reconstructs nonidentifier string keys from SETTABLEKS as bracketed keys", () => {
    const bytes = compile(proto({
      maxStackSize: 4,
      constants: strings("foo-bar", "end", "value"),
      instructions: [
        abc(Opcode.NEWTABLE, 0, 0, 0), 0,
        ad(Opcode.LOADK, 1, 2),
        abc(Opcode.SETTABLEKS, 1, 0, 0), 0,
        ad(Opcode.LOADN, 1, 7),
        abc(Opcode.SETTABLEKS, 1, 0, 0), 1,
        abc(Opcode.RETURN, 0, 2, 0),
      ],
    }));
    const result = decompile(bytes, { opcodeEncoding: "official" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.source).toContain('["foo-bar"]');
      expect(result.source).toContain('["end"]');
      expect(result.source).not.toMatch(/\bfoo-bar\s*=/);
      expect(result.validation).toEqual([]);
    }
  });

  it("keeps simple string keys as ordinary Luau table fields", () => {
    const bytes = compile(proto({
      constants: strings("Enabled"),
      instructions: [
        abc(Opcode.NEWTABLE, 0, 0, 0), 0,
        abc(Opcode.LOADB, 1, 1, 0),
        abc(Opcode.SETTABLEKS, 1, 0, 0), 0,
        abc(Opcode.RETURN, 0, 2, 0),
      ],
    }));
    const result = decompile(bytes);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.source).toContain("Enabled = true");
      expect(result.validation).toEqual([]);
    }
  });

  it("prints property AST nodes with invalid field spellings as indexes", () => {
    expect(printLuau(chunk([{
      kind: "return",
      values: [{ kind: "property", object: ident("table"), name: "foo-bar" }],
    }]))).toBe('return table["foo-bar"]\n');
  });

  it("prints invalid named fields safely even if an earlier pass constructed them", () => {
    expect(printLuau(chunk([{
      kind: "return",
      values: [{
        kind: "table",
        fields: [
          { name: "end", value: lit(1) },
          { name: "normalKey", value: lit(2) },
        ],
      }],
    }]))).toBe('return { ["end"] = 1, normalKey = 2 }\n');
  });
});
