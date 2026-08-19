import { describe, expect, it } from "vitest";
import { decompile } from "../src/decompile.ts";
import { abc, ad, Opcode, compile, proto, ret, sourceOf, strings, importConst } from "./helpers.ts";
import { hasArtificialComments } from "../src/print/LuauPrinter.ts";
import { CaptureType } from "../src/decode/Opcode.ts";

function decompileSource(main: Parameters<typeof sourceOf>[0]): string {
  return sourceOf(main).replace(/\s+$/g, "").replace(/\n+/g, "\n");
}

describe("decompilation", () => {
  it("reconstructs a print call from GETIMPORT/LOADK/CALL", () => {
    const source = decompileSource(
      proto({
        maxStackSize: 2,
        constants: [...strings("print", "hello"), importConst(["print"])],
        instructions: [ad(Opcode.GETIMPORT, 0, 2), 0x40000000, ad(Opcode.LOADK, 1, 1), abc(Opcode.CALL, 0, 2, 1), ret()],
      }),
    );
    expect(source).toBe('print("hello")');
    expect(hasArtificialComments(source)).toBe(false);
  });

  it("is deterministic", () => {
    const bytecode = compile(
      proto({
        constants: [...strings("print", "hello"), importConst(["print"])],
        instructions: [ad(Opcode.GETIMPORT, 0, 2), 0x40000000, ad(Opcode.LOADK, 1, 1), abc(Opcode.CALL, 0, 2, 1), ret()],
      }),
    );
    const first = decompile(bytecode);
    const second = decompile(bytecode);
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.source).toBe(second.source);
    }
  });

  it("inlines a pure arithmetic temporary", () => {
    const source = decompileSource(
      proto({
        numParams: 2,
        locals: [
          { name: "left", startPc: 0, endPc: 3, register: 0 },
          { name: "right", startPc: 0, endPc: 3, register: 1 },
        ],
        instructions: [abc(Opcode.ADD, 2, 0, 1), abc(Opcode.RETURN, 2, 2, 0)],
      }),
    );
    expect(source).toContain("return left + right");
    expect(source).not.toMatch(/value\d/);
  });

  it("does not duplicate a call when folding would change side effects", () => {
    const source = decompileSource(
      proto({
        maxStackSize: 3,
        constants: [...strings("getValue"), importConst(["getValue"])],
        instructions: [
          ad(Opcode.GETIMPORT, 0, 1),
          0x40000000,
          abc(Opcode.CALL, 0, 1, 2),
          abc(Opcode.ADD, 1, 0, 0),
          abc(Opcode.RETURN, 1, 2, 0),
        ],
        locals: [{ name: "value", startPc: 3, endPc: 5, register: 0 }],
      }),
    );
    const calls = source.match(/getValue\(\)/g) ?? [];
    expect(calls.length).toBe(1);
    expect(source).toContain("value + value");
  });

  it("emits method calls from NAMECALL", () => {
    const source = decompileSource(
      proto({
        maxStackSize: 4,
        constants: [...strings("game", "GetService", "Players"), importConst(["game"])],
        instructions: [
          ad(Opcode.GETIMPORT, 0, 3),
          0x40000000,
          ad(Opcode.LOADK, 3, 2),
          abc(Opcode.NAMECALL, 1, 0, 0),
          1,
          abc(Opcode.CALL, 1, 3, 2),
          ret(),
        ],
        locals: [{ name: "Players", startPc: 6, endPc: 7, register: 1 }],
      }),
    );
    expect(source).toMatch(/game:GetService\("Players"\)/);
  });

  it("recovers if/else from a diamond", () => {
    const source = decompileSource(
      proto({
        numParams: 1,
        locals: [{ name: "flag", startPc: 0, endPc: 5, register: 0 }],
        instructions: [
          ad(Opcode.JUMPIFNOT, 0, 2),
          ad(Opcode.LOADN, 1, 1),
          ad(Opcode.JUMP, 0, 1),
          ad(Opcode.LOADN, 1, 2),
          abc(Opcode.RETURN, 1, 2, 0),
        ],
      }),
    );
    // The diamond is recovered as a value-if expression.
    expect(source).toMatch(/local result = if flag then 1 else 2/);
    expect(source).not.toMatch(/end/);
  });

  it("recovers a repeat/until post-test loop", () => {
    const source = decompileSource(
      proto({
        numParams: 1,
        locals: [{ name: "ready", startPc: 0, endPc: 2, register: 0 }],
        instructions: [abc(Opcode.LOADNIL, 1, 0, 0), ad(Opcode.JUMPIFNOT, 0, -2), ret()],
      }),
    );
    expect(source).toMatch(/repeat/);
    expect(source).toMatch(/until/);
    expect(source).not.toMatch(/while true do/);
  });

  it("recovers a numeric for", () => {
    const source = decompileSource(
      proto({
        maxStackSize: 6,
        instructions: [
          ad(Opcode.LOADN, 0, 3),
          ad(Opcode.LOADN, 1, 1),
          ad(Opcode.LOADN, 2, 1),
          ad(Opcode.FORNPREP, 0, 1),
          ad(Opcode.FORNLOOP, 0, -2),
          ret(),
        ],
        locals: [{ name: "index", startPc: 4, endPc: 5, register: 3 }],
      }),
    );
    expect(source).toMatch(/for index = /);
  });

  it("forwards varargs and open packs", () => {
    const source = decompileSource(
      proto({
        isVararg: true,
        maxStackSize: 4,
        constants: [...strings("func"), importConst(["func"])],
        instructions: [
          abc(Opcode.PREPVARARGS, 0, 0, 0),
          ad(Opcode.GETIMPORT, 0, 1),
          0x40000000,
          abc(Opcode.GETVARARGS, 1, 0, 0),
          abc(Opcode.CALL, 0, 0, 0),
          abc(Opcode.RETURN, 0, 0, 0),
        ],
      }),
    );
    expect(source).toMatch(/func\(/);
    expect(source).toMatch(/\.\.\./);
  });

  it("emits a parenthesized single result when CALL requests one value", () => {
    const source = decompileSource(
      proto({
        constants: [...strings("call"), importConst(["call"])],
        instructions: [
          ad(Opcode.GETIMPORT, 0, 1),
          0x40000000,
          abc(Opcode.CALL, 0, 1, 2),
          abc(Opcode.RETURN, 0, 2, 0),
        ],
      }),
    );
    expect(source).toMatch(/return call\(\)/);
  });

  it("reconstructs table literals from NEWTABLE + SETTABLEKS", () => {
    const source = decompileSource(
      proto({
        maxStackSize: 3,
        constants: strings("Enabled", "Name", "alpha"),
        instructions: [
          abc(Opcode.NEWTABLE, 0, 0, 0),
          0,
          abc(Opcode.LOADB, 1, 1, 0),
          abc(Opcode.SETTABLEKS, 1, 0, 0),
          0,
          ad(Opcode.LOADK, 1, 2),
          abc(Opcode.SETTABLEKS, 1, 0, 0),
          1,
          abc(Opcode.RETURN, 0, 2, 0),
        ],
        locals: [{ name: "config", startPc: 1, endPc: 9, register: 0 }],
      }),
    );
    // The returned table gets the module role; the literal must contain the
    // SETTABLEKS fields.
    expect(source).toMatch(/(module|config) = \{[^}]*Enabled/);
    expect(source).toMatch(/Name/);
    expect(source).toMatch(/alpha/);
  });

  it("keeps mutable recursive locals as assignment, not local function", () => {
    const child = proto({
      numUpvalues: 1,
      upvalueNames: ["process"],
      instructions: [abc(Opcode.GETUPVAL, 0, 0, 0), abc(Opcode.RETURN, 0, 2, 0)],
    });
    const source = decompileSource(
      proto({
        children: [child],
        instructions: [
          ad(Opcode.NEWCLOSURE, 0, 0),
          abc(Opcode.CAPTURE, CaptureType.REF, 0, 0),
          ret(),
        ],
        locals: [{ name: "process", startPc: 0, endPc: 3, register: 0 }],
      }),
    );
    expect(source).toMatch(/local process/);
    expect(source).toMatch(/process = function/);
  });

  it("emits local function for an immutable named closure", () => {
    const child = proto({
      debugName: "process",
      instructions: [ret()],
    });
    const source = decompileSource(
      proto({
        children: [child],
        instructions: [ad(Opcode.NEWCLOSURE, 0, 0), ret()],
        locals: [{ name: "process", startPc: 1, endPc: 2, register: 0 }],
      }),
    );
    expect(source).toMatch(/local function process\(\)/);
  });

  it("never inserts explanatory comments", () => {
    const result = decompile(
      compile(
        proto({
          instructions: [ad(Opcode.LOADN, 0, 4), abc(Opcode.RETURN, 0, 2, 0)],
        }),
      ),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.source).not.toContain("--");
      expect(result.validation).toEqual([]);
    }
  });
});
