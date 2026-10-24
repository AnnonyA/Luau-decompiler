import { describe, expect, it } from "vitest";
import { decompile, decodeOnly } from "../src/decompile.ts";
import { decodeInstructionWord } from "../src/decode/DecodedInstruction.ts";
import { abc, Opcode, compile, proto, ret } from "./helpers.ts";

// Project-authored original, official Luau 9d7748a4f324213a18cb8283fa2a77c330225fa0,
// --binary -O1 -g1 --fflags=DebugLuauUserDefinedClasses=true:
// class Counter public value end
// local value = Counter{value = 9}
// value.value += 4
// print(value.value)
// Official runtime with DebugLuauUserDefinedClassesRuntime=true prints 13.
const classBytecode = Buffer.from("ZAMEB0NvdW50ZXIFdmFsdWUGX19pbml0BXByaW50AAGhAQQAAAEKABNBAAAAWgD/AAMAAAAGAQAAWwIBAAAAAABcAgAAFQECAg8CAcwBAAAAJwICBhACAcwBAAAADAIIAAAAcEAPAwHMAQAAABUCAgEWAAEACQMBAwIDAwoAAQEBAgIAAAAAAAAiQAgBAQQAAAACAAAAAAAAEEADBAQAAHBAAAEAARgAAAADAAAAAAEAAAAAAQAAAAABAQAAAAABAQUWAA==", "base64");

describe("experimental class compatibility", () => {
  it("decodes class bytecode for inspection without presenting omitted instructions as source", () => {
    const decoded = decodeOnly(classBytecode, { opcodeEncoding: "official" });
    expect(decoded.module.version).toBe(100);
    const opcodes = decoded.module.prototypes[decoded.module.mainProtoId]!.instructions.map(insn => insn.opcode);
    expect(opcodes).toContain(Opcode.NEWCLASS);
    expect(opcodes).toContain(Opcode.CONSTRUCT);
    expect(opcodes).toContain(Opcode.FINCONSTRUCT);
    const result = decompile(classBytecode, { opcodeEncoding: "official" });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("class reconstruction must not silently discard executable instructions");
    expect(result.code).toBe("unsupported-opcode");
    expect(result.error).toMatch(/NEWCLASS.*prototype 0.*pc 1/);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({severity:"error",code:"unsupported-opcode",prototypeId:0,pc:1}));
  });

  it.each([Opcode.CONSTRUCT, Opcode.FINCONSTRUCT, Opcode.NEWCLASSMEMBER])("rejects unimplemented class opcode %s even without a NEWCLASS", opcode => {
    const words = [abc(opcode, 0, 1, 0)];
    if (opcode !== Opcode.FINCONSTRUCT) words.push(0);
    words.push(ret());
    const result = decompile(compile(proto({instructions:words}), 100), { opcodeEncoding: "official" });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unsupported class opcode was omitted");
    expect(result.code).toBe("unsupported-opcode");
    expect(result.error).toContain(Opcode[opcode]);
  });

  it("retains supported instructions in experimental-version containers", () => {
    const result = decompile(compile(proto({instructions:[ret()]}), 100), { opcodeEncoding: "official" });
    expect(result.ok).toBe(true);
  });

  it("models the constructor destination and class source registers", () => {
    const instruction = decodeInstructionWord(Uint32Array.from([abc(Opcode.CONSTRUCT, 4, 2, 0), 7]), 0, 0);
    expect(instruction.defs).toEqual([4]);
    expect(instruction.uses).toEqual([2]);
    expect(instruction.constantIndex).toBeUndefined(); // AUX is a feedback slot.
  });

  it("models FINCONSTRUCT's object register and successful call-skip target", () => {
    const instruction = decodeInstructionWord(Uint32Array.from([abc(Opcode.FINCONSTRUCT, 4, 0, 3)]), 0, 0);
    expect(instruction.uses).toEqual([4]);
    expect(instruction.jumpTarget).toBe(5);
  });
});
