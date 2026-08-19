import { abc, ad, writeBytecode, type WrittenConstant, type WrittenPrototype } from "../src/decode/BytecodeWriter.ts";
import { CaptureType, Opcode } from "../src/decode/Opcode.ts";
import { decompile } from "../src/decompile.ts";
import { decodeBytecode } from "../src/decode/Decoder.ts";

export function proto(partial: Partial<WrittenPrototype> & { instructions: number[] }): WrittenPrototype {
  return {
    maxStackSize: partial.maxStackSize ?? 8,
    numParams: partial.numParams ?? 0,
    numUpvalues: partial.numUpvalues ?? 0,
    isVararg: partial.isVararg,
    flags: partial.flags,
    typeInfo: partial.typeInfo,
    instructions: partial.instructions,
    constants: partial.constants,
    children: partial.children,
    lineDefined: partial.lineDefined,
    debugName: partial.debugName,
    locals: partial.locals,
    upvalueNames: partial.upvalueNames,
  };
}

export function ret(): number {
  return abc(Opcode.RETURN, 0, 1, 0);
}

export function compile(main: WrittenPrototype, version = 6): Uint8Array {
  return writeBytecode(main, { version, typesVersion: version >= 4 ? 1 : 0 });
}

export function sourceOf(main: WrittenPrototype): string {
  const result = decompile(compile(main));
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.source;
}

export function decode(main: WrittenPrototype) {
  return decodeBytecode(compile(main));
}

export function strings(...values: string[]): WrittenConstant[] {
  return values.map((value) => ({ kind: "string" as const, value }));
}

export function importConst(path: string[]): WrittenConstant {
  return { kind: "import", path };
}

export { abc, ad, Opcode, CaptureType };
