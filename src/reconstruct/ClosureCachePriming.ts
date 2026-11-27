import type { LuauConstant } from "../decode/Constant.js";
import type { DecodedInstruction } from "../decode/DecodedInstruction.js";
import { CaptureType, Opcode } from "../decode/Opcode.js";
import type { BytecodeModule, Prototype } from "../decode/Prototype.js";

/** A raw value identity, not the identity of a source binding or child prototype. */
export type CaptureIdentity =
  | { readonly kind: "closureConstant"; readonly ownerProtoId: number; readonly constantIndex: number }
  | { readonly kind: "nil" }
  | { readonly kind: "boolean"; readonly value: boolean }
  | { readonly kind: "number"; readonly value: number }
  | { readonly kind: "string"; readonly value: string }
  | { readonly kind: "integer"; readonly value: bigint };

export function closureCacheKey(ownerProtoId: number, constantIndex: number): string {
  return `${ownerProtoId}:${constantIndex}`;
}

export function captureIdentityForConstant(ownerProtoId: number, constantIndex: number): CaptureIdentity {
  return { kind: "closureConstant", ownerProtoId, constantIndex };
}

/** NaN has no reflexive identity in luaO_rawequalObj. Do not turn it into a key. */
export function captureIdentityForLiteral(constant: LuauConstant | undefined): CaptureIdentity | undefined {
  if (!constant) return undefined;
  switch (constant.kind) {
    case "nil": return { kind: "nil" };
    case "boolean": return { kind: "boolean", value: constant.value };
    case "number": return Number.isNaN(constant.value) ? undefined : { kind: "number", value: constant.value };
    case "string": return { kind: "string", value: constant.value };
    case "integer": return { kind: "integer", value: constant.value };
    default: return undefined;
  }
}

export function sameCaptureIdentity(left: CaptureIdentity, right: CaptureIdentity): boolean {
  if (left.kind !== right.kind) return false;
  switch (left.kind) {
    case "closureConstant":
      return right.kind === "closureConstant" && left.ownerProtoId === right.ownerProtoId &&
        left.constantIndex === right.constantIndex;
    case "nil": return true;
    case "boolean": return right.kind === "boolean" && left.value === right.value;
    case "number": return right.kind === "number" && left.value === right.value;
    case "string": return right.kind === "string" && left.value === right.value;
    case "integer": return right.kind === "integer" && left.value === right.value;
  }
}

type PrimitiveValue = { kind: "primitive"; identity: Exclude<CaptureIdentity, { kind: "closureConstant" }> };
type ClosureValue = {
  kind: "closure";
  protoId: number;
  identity?: CaptureIdentity;
  captures: AbstractValue[];
};
type TableValue = { kind: "table"; fields: Map<string, AbstractValue> };
type AbstractValue = PrimitiveValue | ClosureValue | TableValue | { kind: "unknown" };

const unknown: AbstractValue = { kind: "unknown" };
const nil: PrimitiveValue = { kind: "primitive", identity: { kind: "nil" } };
const MAX_STEPS = 4096;
const MAX_DEPTH = 16;

function identityOf(value: AbstractValue): CaptureIdentity | undefined {
  return value.kind === "primitive" ? value.identity : value.kind === "closure" ? value.identity : undefined;
}

function rawEqual(left: AbstractValue, right: AbstractValue): boolean | undefined {
  if (left.kind === "unknown" || right.kind === "unknown") return undefined;
  if (left.kind !== right.kind) return false;
  if (left.kind === "primitive" && right.kind === "primitive") {
    return sameCaptureIdentity(left.identity, right.identity);
  }
  // Each local allocation and each loaded constant has one abstract object.
  // A NEWCLOSURE object deliberately has no exportable constant identity.
  return left === right;
}

function truthy(value: AbstractValue): boolean | undefined {
  if (value.kind === "unknown") return undefined;
  if (value.kind !== "primitive") return true;
  return value.identity.kind !== "nil" && (value.identity.kind !== "boolean" || value.identity.value);
}

function numberOf(value: AbstractValue): number | undefined {
  return value.kind === "primitive" && value.identity.kind === "number" ? value.identity.value : undefined;
}

function tableKey(value: AbstractValue): string | undefined {
  const identity = identityOf(value);
  if (!identity || identity.kind === "nil") return undefined;
  if (identity.kind === "closureConstant") return `closure:${closureCacheKey(identity.ownerProtoId, identity.constantIndex)}`;
  return `${identity.kind}:${String(identity.value)}`;
}

/**
 * Find first capture vectors proved by a bounded, deterministic prefix of main.
 *
 * This is an abstract analysis, not execution of the VM or source. It follows
 * only known local closures, primitive branches and numeric loop controls.
 * Unknown calls, global/environment reads, REF cells, unknown branches, open
 * argument/result packs and unsupported instructions end the prefix. Private
 * NEWTABLE objects may be filled/read before any unknown call: they cannot yet
 * have a metatable or an external alias.
 *
 * The entry contract is the initial environment established by luau_load. A
 * result records initialization, NOT a proof that a later evaluation reuses K:
 * callers must separately prove its environment/capture identity, or use only
 * a guaranteed capture mismatch. Distinct constant keys can never denote the
 * same loaded closure, even when they reference the same child prototype.
 *
 * K retains its first captures on a miss. A stopped prefix does not reset K.
 * Mutable child upvalue slots are excluded, as are unknown main arguments.
 * Limits only discard evidence; they never approximate a branch or a call.
 *
 * Independently implemented from official Luau 9d7748a4 lvmexecute.cpp and
 * lvmload.cpp; Tovek 77edf387 closure_identity.rs informed the first-cache
 * invariant. No implementation code was copied from the reference.
 */
export function analyzeClosureCachePriming(module: BytecodeModule): ReadonlyMap<string, readonly CaptureIdentity[]> {
  const result = new Map<string, readonly CaptureIdentity[]>();
  const loaded = new Map<string, ClosureValue>();
  const protos = new Map(module.prototypes.map(proto => [proto.id, proto]));
  const instructionMaps = new Map(module.prototypes.map(proto => [proto.id, new Map(proto.instructions.map(i => [i.pc, i]))]));
  let steps = 0;
  let stopped = false;

  function stop(): undefined {
    stopped = true;
    return undefined;
  }

  function primitive(constant: LuauConstant | undefined): PrimitiveValue | undefined {
    const identity = captureIdentityForLiteral(constant);
    return identity && identity.kind !== "closureConstant" ? { kind: "primitive", identity } : undefined;
  }

  function run(closure: ClosureValue, args: readonly AbstractValue[], depth: number): AbstractValue[] | undefined {
    if (depth > MAX_DEPTH) return stop();
    const proto = protos.get(closure.protoId);
    const instructions = instructionMaps.get(closure.protoId);
    if (!proto || !instructions) return stop();
    const registers: AbstractValue[] = Array.from({ length: proto.maxStackSize }, () => unknown);
    for (let i = 0; i < proto.numParams; i++) registers[i] = args[i] ?? nil;
    const get = (register: number): AbstractValue => registers[register] ?? unknown;
    const set = (register: number, value: AbstractValue): void => { registers[register] = value; };
    let pc = 0;

    function captures(insn: DecodedInstruction, child: Prototype): AbstractValue[] | undefined {
      const values: AbstractValue[] = [];
      for (let index = 0; index < child.numUpvalues; index++) {
        if (++steps > MAX_STEPS) return stop();
        const capture = instructions!.get(insn.pc + insn.width + index);
        if (capture?.opcode !== Opcode.CAPTURE) return stop();
        const value = capture.a === CaptureType.VAL ? get(capture.b) :
          capture.a === CaptureType.UPVAL ? closure.captures[capture.b] ?? unknown : unknown;
        if (value.kind === "unknown") return stop();
        values.push(value);
      }
      return values;
    }

    while (!stopped) {
      if (++steps > MAX_STEPS) return stop();
      const insn = instructions.get(pc);
      if (!insn) return stop();
      const next = pc + insn.width;
      pc = next;
      switch (insn.opcode) {
        case Opcode.NOP:
        case Opcode.PREPVARARGS:
        case Opcode.CLOSEUPVALS:
        case Opcode.COVERAGE:
          break;
        case Opcode.LOADNIL: set(insn.a, nil); break;
        case Opcode.LOADB:
          set(insn.a, { kind: "primitive", identity: { kind: "boolean", value: insn.b !== 0 } });
          pc += insn.c;
          break;
        case Opcode.LOADN:
          set(insn.a, { kind: "primitive", identity: { kind: "number", value: insn.d } });
          break;
        case Opcode.LOADK:
        case Opcode.LOADKX: {
          const value = primitive(proto.constants[insn.constantIndex ?? -1]);
          if (!value) return stop();
          set(insn.a, value);
          break;
        }
        case Opcode.MOVE: set(insn.a, get(insn.b)); break;
        case Opcode.NOT: {
          const value = truthy(get(insn.b));
          if (value === undefined) return stop();
          set(insn.a, { kind: "primitive", identity: { kind: "boolean", value: !value } });
          break;
        }
        case Opcode.GETUPVAL:
          if (!closure.captures[insn.b]) return stop();
          set(insn.a, closure.captures[insn.b]!);
          break;
        case Opcode.GETVARARGS:
          // Main arguments are not part of bytecode evidence. Do not assume nil.
          return stop();
        case Opcode.NEWCLOSURE:
        case Opcode.DUPCLOSURE: {
          const isDup = insn.opcode === Opcode.DUPCLOSURE;
          const constant = isDup ? proto.constants[insn.d] : undefined;
          const childId = isDup ? constant?.kind === "closure" ? constant.protoId : undefined : proto.childProtoIds[insn.d];
          const child = childId === undefined ? undefined : protos.get(childId);
          if (!child) return stop();
          const key = closureCacheKey(proto.id, insn.d);
          const existing = isDup ? loaded.get(key) : undefined;
          let value: ClosureValue = existing ?? {
            kind: "closure", protoId: child.id, captures: [],
            identity: isDup ? captureIdentityForConstant(proto.id, insn.d) : undefined,
          };
          // The VM exposes the destination before reading a self capture.
          set(insn.a, value);
          let captured = captures(insn, child);
          if (!captured) return undefined;
          if (isDup && !existing) {
            const identities = captured.map(identityOf);
            if (identities.some(identity => identity === undefined) ||
              child.instructions.some(i => i.opcode === Opcode.SETUPVAL)) return stop();
            value.captures = captured;
            loaded.set(key, value);
            result.set(key, identities as CaptureIdentity[]);
          } else if (existing) {
            const matches = captured.map((capture, index) => rawEqual(capture, existing.captures[index] ?? unknown));
            if (matches.some(match => match === undefined)) return stop();
            if (matches.some(match => !match)) {
              value = { kind: "closure", protoId: child.id, captures: [] };
              set(insn.a, value);
              // A mismatch restarts captures after replacing the self register.
              captured = captures(insn, child);
              if (!captured) return undefined;
              value.captures = captured;
            }
          } else {
            value.captures = captured;
          }
          pc = next + child.numUpvalues;
          break;
        }
        case Opcode.CALL:
        case Opcode.CALLFB: {
          const call = insn.call;
          if (!call || call.argumentCount === "multret" || call.resultCount === "multret") return stop();
          const callee = get(call.functionRegister);
          if (callee.kind !== "closure") return stop();
          const arguments_ = Array.from({ length: call.argumentCount }, (_, index) => get(call.argumentBase + index));
          const returned = run(callee, arguments_, depth + 1);
          if (!returned) return undefined;
          for (let index = 0; index < call.resultCount; index++) set(call.functionRegister + index, returned[index] ?? nil);
          break;
        }
        case Opcode.RETURN:
          if (insn.b === 0) return stop();
          return Array.from({ length: insn.b - 1 }, (_, index) => get(insn.a + index));
        case Opcode.JUMP:
        case Opcode.JUMPBACK:
        case Opcode.JUMPX:
          if (insn.jumpTarget === undefined) return stop();
          pc = insn.jumpTarget;
          break;
        case Opcode.JUMPIF:
        case Opcode.JUMPIFNOT: {
          const condition = truthy(get(insn.a));
          if (condition === undefined || insn.jumpTarget === undefined) return stop();
          if (condition === (insn.opcode === Opcode.JUMPIF)) pc = insn.jumpTarget;
          break;
        }
        case Opcode.FORNPREP:
        case Opcode.FORNLOOP: {
          const limit = numberOf(get(insn.a));
          const stride = numberOf(get(insn.a + 1));
          const previous = numberOf(get(insn.a + 2));
          if (limit === undefined || stride === undefined || previous === undefined || insn.jumpTarget === undefined) return stop();
          const index = insn.opcode === Opcode.FORNLOOP ? previous + stride : previous;
          if (!Number.isFinite(index) || !Number.isFinite(limit) || !Number.isFinite(stride)) return stop();
          if (insn.opcode === Opcode.FORNLOOP) set(insn.a + 2, { kind: "primitive", identity: { kind: "number", value: index } });
          const continues = stride > 0 ? index <= limit : limit <= index;
          if (continues === (insn.opcode === Opcode.FORNLOOP)) pc = insn.jumpTarget;
          break;
        }
        case Opcode.NEWTABLE:
          set(insn.a, { kind: "table", fields: new Map() });
          break;
        case Opcode.SETTABLE:
        case Opcode.SETTABLEN:
        case Opcode.SETTABLEKS: {
          const table = get(insn.b);
          const keyValue = insn.opcode === Opcode.SETTABLE ? get(insn.c) : insn.opcode === Opcode.SETTABLEN ?
            { kind: "primitive" as const, identity: { kind: "number" as const, value: insn.c + 1 } } : primitive(proto.constants[insn.aux ?? -1]);
          const key = keyValue && tableKey(keyValue);
          if (table.kind !== "table" || key === undefined) return stop();
          table.fields.set(key, get(insn.a));
          break;
        }
        case Opcode.GETTABLE:
        case Opcode.GETTABLEN:
        case Opcode.GETTABLEKS: {
          const table = get(insn.b);
          const keyValue = insn.opcode === Opcode.GETTABLE ? get(insn.c) : insn.opcode === Opcode.GETTABLEN ?
            { kind: "primitive" as const, identity: { kind: "number" as const, value: insn.c + 1 } } : primitive(proto.constants[insn.aux ?? -1]);
          const key = keyValue && tableKey(keyValue);
          if (table.kind !== "table" || key === undefined) return stop();
          set(insn.a, table.fields.get(key) ?? nil);
          break;
        }
        default:
          return stop();
      }
    }
    return undefined;
  }

  const main = protos.get(module.mainProtoId);
  if (main && main.numUpvalues === 0) {
    run({ kind: "closure", protoId: main.id, captures: [] }, Array.from({ length: main.numParams }, () => unknown), 0);
  }
  return result;
}
