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
  deltas: Uint8Array;
  absolute: Int32Array;
}

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
  if (!info || pc < 0 || pc >= prototype.code.length) {
    return undefined;
  }
  const interval = pc >> info.lineGapLog2;
  const base = info.absolute[interval] ?? 0;
  const start = interval << info.lineGapLog2;
  let offset = 0;
  for (let i = start; i <= pc; i++) {
    offset += info.deltas[i] ?? 0;
  }
  return base + offset;
}
