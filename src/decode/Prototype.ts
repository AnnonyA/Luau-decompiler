import type { DecodedInstruction } from "./DecodedInstruction.js";
import type { LuauConstant } from "./Constant.js";

export interface LocalDebugInfo {
  name: string;
  startPc: number;
  endPc: number;
  register: number;
}

export interface LineInfo {
  lineGapLog2: number;
  /** Serialized differences, retained unchanged for bytecode inspection. */
  deltas: Uint8Array;
  absolute: Int32Array;
}

// Module line metadata is immutable after decoding. Weak ownership avoids
// retaining modules across decompilations; each subsequent lookup is O(1).
const resolvedLines = new WeakMap<LineInfo, {offsets: Uint8Array; bases: Int32Array}>();

export interface FeedbackSlot {
  kind: number;
  pc: number;
}

export interface Prototype {
  id: number;
  maxStackSize: number;
  numParams: number;
  numUpvalues: number;
  isVararg: boolean;
  flags: number;
  typeInfo: Uint8Array | undefined;
  code: Uint32Array;
  instructions: DecodedInstruction[];
  constants: LuauConstant[];
  childProtoIds: number[];
  lineDefined: number;
  debugName?: string;
  lineInfo?: LineInfo;
  locals: LocalDebugInfo[];
  upvalueNames: string[];
  feedback: FeedbackSlot[];
  cost?: bigint;
}

export interface UserdataType {
  index: number;
  name: string;
}

export interface BytecodeModule {
  version: number;
  typesVersion: number;
  strings: string[];
  userdataTypes: UserdataType[];
  prototypes: Prototype[];
  mainProtoId: number;
}

export function lineAt(prototype: Prototype, pc: number): number | undefined {
  const info = prototype.lineInfo;
  if (!info || !Number.isInteger(pc) || pc < 0 || pc >= prototype.code.length) {
    return undefined;
  }
  let resolved = resolvedLines.get(info);
  if (!resolved) {
    const offsets = new Uint8Array(info.deltas.length), bases = new Int32Array(info.absolute.length);
    let offset = 0, base = 0;
    for (let i = 0; i < offsets.length; i++) {
      offset = (offset + info.deltas[i]!) & 255;
      offsets[i] = offset;
    }
    for (let i = 0; i < bases.length; i++) {
      base = (base + info.absolute[i]!) | 0;
      bases[i] = base;
    }
    resolved = {offsets, bases};
    resolvedLines.set(info, resolved);
  }
  return (resolved.bases[pc >> info.lineGapLog2] ?? 0) + (resolved.offsets[pc] ?? 0);
}
