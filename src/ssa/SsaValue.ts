import type { DecodedInstruction } from "../decode/DecodedInstruction.js";
import type { SideEffectClass } from "../analysis/SideEffects.js";

export type ValueClass =
  | "parameter"
  | "source-local"
  | "upvalue"
  | "temporary"
  | "phi"
  | "call-result"
  | "iterator-state"
  | "control-temporary"
  | "synthetic";

export type SsaOp =
  | { kind: "parameter"; index: number }
  | { kind: "undefined" }
  | { kind: "constant"; constantIndex: number }
  | { kind: "immediate"; value: number | boolean | null }
  | { kind: "move"; source: number }
  | { kind: "phi"; operands: Array<{ pred: number; value: number }> }
  | { kind: "binary"; op: string; left: number; right: number }
  | { kind: "unary"; op: string; operand: number }
  | { kind: "concat"; operands: number[] }
  | { kind: "global"; nameIndex: number; write: boolean; source?: number }
  | { kind: "import"; constantIndex: number }
  | { kind: "upvalue"; index: number; write: boolean; source?: number }
  | { kind: "table-get"; table: number; key: number | { constantIndex: number } | { integer: number } }
  | { kind: "table-set"; table: number; key: number | { constantIndex: number } | { integer: number }; value: number }
  | { kind: "new-table"; hashLog: number; arraySize: number }
  | { kind: "dup-table"; constantIndex: number }
  | { kind: "set-list"; table: number; startIndex: number; values: number[]; open?: number }
  | { kind: "namecall"; object: number; nameIndex: number }
  | { kind: "call"; callee: number; args: number[]; argOpen?: boolean; results: number; resultOpen?: boolean }
  | { kind: "vararg"; count: number | "multret" }
  | { kind: "closure"; protoIndex: number; captures: Array<{ type: number; value?: number; upvalue?: number }> }
  | { kind: "length"; operand: number }
  | { kind: "for-index" }
  | { kind: "unknown"; opcode: number };

export interface SsaValue {
  id: number;
  register: number;
  version: number;
  block: number;
  pc: number;
  op: SsaOp;
  classification: ValueClass;
  sideEffect: SideEffectClass;
  uses: number[];
  debugName?: string;
  instruction?: DecodedInstruction;
}

export interface PhiNode {
  value: number;
  register: number;
  block: number;
  operands: Array<{ pred: number; value: number }>;
}

export interface ValuePack {
  kind: "fixed" | "open";
  values: number[];
  openProducer?: number;
  parenthesized: boolean;
}
