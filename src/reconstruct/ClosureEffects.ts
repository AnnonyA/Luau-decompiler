import type { ControlFlowGraph } from "../cfg/ControlFlowGraph.js";
import type { DecodedInstruction } from "../decode/DecodedInstruction.js";
import { Opcode } from "../decode/Opcode.js";
import type { BytecodeModule, Prototype } from "../decode/Prototype.js";
import type { SsaFunction } from "../ssa/SsaBuilder.js";

/** Small, deliberately closed effect proof for the interval between two loads
 * of a closure constant. In particular, a CALL is not harmless just because
 * its result is unused, and a table write is not harmless just because its
 * receiver has the same register number as an earlier NEWTABLE. */
export class ClosureEffects {
  constructor(private readonly module: BytecodeModule, private readonly proto: Prototype,
    private readonly cfg: ControlFlowGraph, private readonly ssa: SsaFunction) {}

  valueAt(insn: DecodedInstruction, register: number): number | undefined {
    return this.ssa.useAt.get(`${this.cfg.blockOfPc.get(insn.pc)}:${insn.pc}:${register}`);
  }

  root(value: number | undefined): number | undefined {
    const seen = new Set<number>();
    while (value !== undefined && !seen.has(value)) {
      seen.add(value);
      const op = this.ssa.values[value]?.op;
      if (op?.kind !== "move") return value;
      value = op.source;
    }
    return undefined;
  }

  /** Escape invalidation must follow may-alias phis as well as exact MOVE
   * aliases. A join is not evidence that the original object disappeared. */
  private mayBe(value: number | undefined, target: number, seen = new Set<number>()): boolean {
    value = this.root(value);
    if (value === target) return true;
    if (value === undefined || seen.has(value)) return false;
    if (seen.size >= 64) return true;
    const op = this.ssa.values[value]?.op;
    if (op?.kind !== "phi") return false;
    seen = new Set(seen).add(value);
    return op.operands.some(operand => this.mayBe(operand.value, target, seen));
  }

  /** Imports can use the environment's __index after it becomes unsafe. The
   * caller may enable this case only while its entry-environment proof holds. */
  neutral(insn: DecodedInstruction, importsAreSafe: boolean): boolean {
    if (inert.has(insn.opcode)) return true;
    if (insn.opcode === Opcode.GETIMPORT) return importsAreSafe;
    if (insn.opcode === Opcode.SETTABLE || insn.opcode === Opcode.SETTABLEKS ||
        insn.opcode === Opcode.SETTABLEN || insn.opcode === Opcode.SETLIST)
      return this.privateTable(this.valueAt(insn, insn.opcode === Opcode.SETLIST ? insn.a : insn.b), insn.pc);
    if (insn.opcode === Opcode.GETTABLE || insn.opcode === Opcode.GETTABLEKS || insn.opcode === Opcode.GETTABLEN)
      return this.privateTable(this.valueAt(insn, insn.b), insn.pc);
    if (insn.opcode === Opcode.CALL || insn.opcode === Opcode.CALLFB) {
      if (!insn.call || insn.call.argumentCount === "multret") return false;
      const callee = this.knownFunction(this.valueAt(insn, insn.a), insn.pc);
      if (!callee) return false;
      const args = Array.from({length: insn.call.argumentCount}, (_, i) =>
        this.numeric(this.valueAt(insn, insn.a + 1 + i)));
      return this.pureFunction(callee, args);
    }
    if (numericBinary.has(insn.opcode))
      return insn.uses.every(r => this.numeric(this.valueAt(insn, r))) &&
        (insn.constantIndex === undefined || this.proto.constants[insn.constantIndex]?.kind === "number");
    if (insn.opcode === Opcode.MINUS) return this.numeric(this.valueAt(insn, insn.b));
    // Equality of numbers/functions cannot dispatch a metamethod. A comparison
    // between arbitrary tables, arithmetic on unknown values, and unknown calls
    // remain barriers (including calls made through an escaped table).
    if (insn.opcode === Opcode.JUMPIFEQ || insn.opcode === Opcode.JUMPIFNOTEQ)
      return insn.uses.every(r => this.numeric(this.valueAt(insn, r)) ||
        this.knownFunction(this.valueAt(insn, r), insn.pc) !== undefined);
    return false;
  }

  private numeric(value: number | undefined, seen = new Set<number>()): boolean {
    value = this.root(value);
    if (value === undefined || seen.has(value) || seen.size > 32) return false;
    seen = new Set(seen).add(value);
    if (value < 0) return this.proto.constants[-value - 1]?.kind === "number";
    const definition = this.ssa.values[value];
    const op = definition?.op;
    if (op?.kind === "binary") return this.numeric(op.left, seen) && this.numeric(op.right, seen);
    if (op?.kind === "unary" && op.op === "-") return this.numeric(op.operand, seen);
    if (op?.kind === "table-get" && definition?.instruction && this.privateTable(op.table, definition.pc)) {
      const values = this.tableFieldValues(op.table, op.key, definition.instruction);
      return values !== undefined && values.length > 0 && values.every(v => this.numeric(v, seen));
    }
    return op?.kind === "immediate" ? typeof op.value === "number"
      : op?.kind === "constant" && this.proto.constants[op.constantIndex]?.kind === "number";
  }

  /** Last writes to one constant field on every incoming path. No value is
   * inferred from a different branch merely because its PC is smaller. */
  private tableFieldValues(table: number, key: number | {constantIndex: number} | {integer: number},
    read: DecodedInstruction): number[] | undefined {
    table = this.root(table) ?? -1;
    const allocation = this.ssa.values[table];
    const wanted = typeof key === "number" ? undefined : "integer" in key ? `n:${key.integer}`
      : this.fieldKey(this.proto.constants[key.constantIndex]);
    if (!allocation || wanted === undefined) return undefined;
    const pending = [{id: this.cfg.blockOfPc.get(read.pc)!, limit: read.pc}];
    const seen = new Set<string>(), values: number[] = [];
    let budget = 4096;
    while (pending.length) {
      const {id, limit} = pending.pop()!;
      const visit = `${id}:${limit}`;
      if (seen.has(visit)) return undefined; // cyclic/ambiguous field lifetime
      seen.add(visit);
      let found = false;
      const instructions = this.cfg.blocks[id]!.instructions;
      for (let index = instructions.length - 1; index >= 0; index--) {
        if (--budget < 0) return undefined;
        const insn = instructions[index]!;
        if (insn.pc >= limit) continue;
        if (id === allocation.block && insn.pc <= allocation.pc) {
          const template = allocation.op.kind === "dup-table" ? this.proto.constants[allocation.op.constantIndex] : undefined;
          const entry = template?.kind === "tableWithConstants"
            ? template.entries.slice().reverse().find(item => this.fieldKey(this.proto.constants[item.key]) === wanted) : undefined;
          if (!entry || entry.value < 0) return undefined;
          values.push(-entry.value - 1);
          found = true;
          break;
        }
        if (insn.opcode === Opcode.SETLIST && this.mayBe(this.valueAt(insn, insn.a), table)) {
          if (this.root(this.valueAt(insn, insn.a)) !== table) return undefined;
          if (!wanted.startsWith("n:")) continue;
          const offset = Number(wanted.slice(2)) - (insn.aux ?? 1);
          if (!Number.isInteger(offset) || offset < 0) continue;
          if (insn.c === 0) return undefined;
          if (offset >= insn.c - 1) continue;
          const value = this.valueAt(insn, insn.b + offset);
          if (value === undefined) return undefined;
          values.push(value);
          found = true;
          break;
        }
        if (![Opcode.SETTABLE, Opcode.SETTABLEKS, Opcode.SETTABLEN].includes(insn.opcode) ||
            !this.mayBe(this.valueAt(insn, insn.b), table)) continue;
        if (this.root(this.valueAt(insn, insn.b)) !== table) return undefined;
        const storedKey = insn.opcode === Opcode.SETTABLEN ? `n:${insn.c + 1}`
          : insn.opcode === Opcode.SETTABLEKS ? this.fieldKey(this.proto.constants[insn.constantIndex ?? -1]) : undefined;
        if (storedKey === undefined) return undefined;
        if (storedKey !== wanted) continue;
        const value = this.valueAt(insn, insn.a);
        if (value === undefined) return undefined;
        values.push(value);
        found = true;
        break;
      }
      if (found) continue;
      const predecessors = this.cfg.blocks[id]!.predecessors;
      if (!predecessors.length) return undefined;
      for (const parent of predecessors) pending.push({id: parent, limit: Infinity});
    }
    return values;
  }

  private fieldKey(constant: Prototype["constants"][number] | undefined): string | undefined {
    return constant?.kind === "string" ? `s:${constant.value}` : constant?.kind === "number" ? `n:${constant.value}` : undefined;
  }

  /** The allocation must still be private on every path reaching this PC.
   * Reads/writes of its contents are fine; passing, returning, capturing,
   * or storing the table itself ends the proof. That excludes __newindex and
   * aliases on which an unknown callee could install a metatable. */
  private privateTable(value: number | undefined, pc: number): boolean {
    value = this.root(value);
    const definition = value === undefined ? undefined : this.ssa.values[value];
    if (!definition || (definition.op.kind !== "new-table" && definition.op.kind !== "dup-table")) return false;
    const pending = [{id: this.cfg.blockOfPc.get(pc)!, limit: pc}];
    const visited = new Map<number, number>();
    while (pending.length) {
      const {id, limit} = pending.pop()!;
      if ((visited.get(id) ?? -1) >= limit) continue;
      visited.set(id, limit);
      const current = this.cfg.blocks[id]!;
      for (const insn of current.instructions) {
        if (insn.pc >= limit || (id === definition.block && insn.pc <= definition.pc)) continue;
        for (const register of insn.uses) {
          if (!this.mayBe(this.valueAt(insn, register), value!)) continue;
          if (insn.opcode === Opcode.MOVE) continue;
          // Merely closing over a table does not publish it. A closure that is
          // still a private, uncalled local cannot install a metatable or write
          // the table on behalf of an unknown caller.
          if (insn.opcode === Opcode.CAPTURE && this.uncalledCapture(insn, pc)) continue;
          const receiver = insn.opcode === Opcode.SETLIST ? insn.a : insn.b;
          if (tableAccess.has(insn.opcode) && register === receiver && this.root(this.valueAt(insn, register)) === value &&
              // The same table in a key/value operand escapes even if it is
              // simultaneously the receiver (t[t] = t).
              !((insn.opcode === Opcode.SETTABLE || insn.opcode === Opcode.SETTABLEKS || insn.opcode === Opcode.SETTABLEN) &&
                this.mayBe(this.valueAt(insn, insn.a), value!)) &&
              !(insn.opcode === Opcode.SETTABLE && this.mayBe(this.valueAt(insn, insn.c), value!))) continue;
          return false;
        }
      }
      if (id === definition.block) continue;
      if (!current.predecessors.length) return false;
      for (const parent of current.predecessors) pending.push({id: parent, limit: Infinity});
    }
    return true;
  }

  private uncalledCapture(capture: DecodedInstruction, end: number): boolean {
    let index = this.proto.instructions.indexOf(capture) - 1;
    while (index >= 0 && this.proto.instructions[index]!.opcode === Opcode.CAPTURE) index--;
    const load = this.proto.instructions[index];
    if (!load || (load.opcode !== Opcode.DUPCLOSURE && load.opcode !== Opcode.NEWCLOSURE)) return false;
    const home = this.cfg.blockOfPc.get(load.pc)!;
    const closure = this.ssa.defAt.get(`${home}:${load.pc}:${load.a}`);
    if (closure === undefined) return false;
    const pending = [{id: this.cfg.blockOfPc.get(end)!, limit: end}], checked = new Map<number, number>();
    while (pending.length) {
      const {id, limit} = pending.pop()!;
      if ((checked.get(id) ?? -1) >= limit) continue;
      checked.set(id, limit);
      const current = this.cfg.blocks[id]!;
      for (const insn of current.instructions) {
        if (insn.pc >= limit || (id === home && insn.pc <= load.pc)) continue;
        if (insn.uses.some(r => this.mayBe(this.valueAt(insn, r), closure)) && insn.opcode !== Opcode.MOVE) return false;
      }
      if (id !== home) for (const predecessor of current.predecessors) pending.push({id: predecessor, limit: Infinity});
    }
    return true;
  }

  private knownFunction(value: number | undefined, pc: number, seen = new Set<number>()): Prototype | undefined {
    value = this.root(value);
    if (value === undefined || seen.has(value) || seen.size > 64) return undefined;
    seen.add(value);
    const definition = this.ssa.values[value];
    const op = definition?.op;
    if (op?.kind === "constant") {
      const constant = this.proto.constants[op.constantIndex];
      return constant?.kind === "closure" ? this.module.prototypes[constant.protoId] : undefined;
    }
    if (op?.kind === "closure") return this.module.prototypes[this.proto.childProtoIds[op.protoIndex] ?? -1];
    if (op?.kind === "call" && !op.argOpen) {
      if (definition?.instruction?.a !== definition?.register) return undefined;
      const callee = this.knownFunction(op.callee, definition!.pc, seen);
      if (!callee || !this.pureFunction(callee, op.args.map(v => this.numeric(v)))) return undefined;
      const functions = new Map<number, Prototype>();
      for (const insn of callee.instructions) {
        if (insn.opcode === Opcode.RETURN) return insn.b === 2 ? functions.get(insn.a) : undefined;
        const moved = insn.opcode === Opcode.MOVE ? functions.get(insn.b) : undefined;
        for (const register of insn.defs) functions.delete(register);
        const constant = insn.opcode === Opcode.DUPCLOSURE ? callee.constants[insn.d] : undefined;
        const child = constant?.kind === "closure" ? this.module.prototypes[constant.protoId]
          : insn.opcode === Opcode.NEWCLOSURE ? this.module.prototypes[callee.childProtoIds[insn.d] ?? -1] : moved;
        if (child) functions.set(insn.a, child);
      }
      return undefined;
    }
    if (op?.kind !== "table-get" || !this.privateTable(op.table, pc)) return undefined;
    const table = this.root(op.table);
    const allocation = table === undefined ? undefined : this.ssa.values[table];
    if (!allocation || typeof op.key === "number" || !("integer" in op.key)) return undefined;
    // Being private proves absence of metamethods, not immutable contents.
    // The constructor-value proof below is intentionally straight-line: a
    // store in another block invalidates it, including a detour whose PC lies
    // outside the lexical interval between allocation and read.
    for (const insn of this.proto.instructions) {
      const receiver = insn.opcode === Opcode.SETLIST ? insn.a : insn.b;
      const write = insn.opcode === Opcode.SETLIST || insn.opcode === Opcode.SETTABLE ||
        insn.opcode === Opcode.SETTABLEKS || insn.opcode === Opcode.SETTABLEN;
      if (write && this.mayBe(this.valueAt(insn, receiver), table!) &&
          (this.cfg.blockOfPc.get(insn.pc) !== allocation.block || this.root(this.valueAt(insn, receiver)) !== table)) return undefined;
    }
    let stored: number | undefined;
    for (const insn of this.cfg.blocks[allocation.block]!.instructions) {
      if (insn.pc <= allocation.pc || insn.pc >= definition!.pc) continue;
      if (insn.opcode === Opcode.SETLIST && this.root(this.valueAt(insn, insn.a)) === table) {
        if (insn.c === 0) return undefined;
        const offset = op.key.integer - (insn.aux ?? 1);
        if (offset >= 0 && offset < insn.c - 1) stored = this.valueAt(insn, insn.b + offset);
      } else if (insn.opcode === Opcode.SETTABLEN && this.root(this.valueAt(insn, insn.b)) === table) {
        if (insn.c + 1 === op.key.integer) stored = this.valueAt(insn, insn.a);
      } else if ((insn.opcode === Opcode.SETTABLE || insn.opcode === Opcode.SETTABLEKS) &&
                 this.root(this.valueAt(insn, insn.b)) === table) return undefined;
    }
    return this.knownFunction(stored, pc, seen);
  }

  /** No recursion, calls, globals, table accesses, or metamethod-capable
   * unknown arithmetic. This suffices for a literal factory and arithmetic
   * closures called with known numeric arguments, without trusting names. */
  private pureFunction(proto: Prototype, args: readonly boolean[]): boolean {
    if (proto.instructions.length > 256) return false;
    const numbers = new Set(args.flatMap((number, index) => number ? [index] : []));
    for (const insn of proto.instructions) {
      if (insn.jumpTarget !== undefined) return false;
      const numericUses = insn.uses.every(r => numbers.has(r));
      const moveNumeric = insn.opcode === Opcode.MOVE && numbers.has(insn.b);
      if (numericBinary.has(insn.opcode) || insn.opcode === Opcode.MINUS) {
        if (!numericUses || (insn.constantIndex !== undefined && proto.constants[insn.constantIndex]?.kind !== "number")) return false;
      } else if (!pureBody.has(insn.opcode)) return false;
      for (const register of insn.defs) numbers.delete(register);
      if (insn.opcode === Opcode.LOADN || moveNumeric || numericBinary.has(insn.opcode) || insn.opcode === Opcode.MINUS ||
          ((insn.opcode === Opcode.LOADK || insn.opcode === Opcode.LOADKX) &&
           proto.constants[insn.constantIndex ?? insn.d]?.kind === "number")) numbers.add(insn.a);
    }
    return true;
  }
}

const inert = new Set([Opcode.NOP, Opcode.MOVE, Opcode.LOADNIL, Opcode.LOADB, Opcode.LOADN, Opcode.LOADK, Opcode.LOADKX,
  Opcode.CAPTURE, Opcode.JUMP, Opcode.JUMPIF, Opcode.JUMPIFNOT, Opcode.NEWTABLE, Opcode.DUPTABLE, Opcode.NEWCLOSURE,
  Opcode.DUPCLOSURE, Opcode.GETVARARGS, Opcode.PREPVARARGS, Opcode.NOT, Opcode.AND, Opcode.OR, Opcode.ANDK, Opcode.ORK,
  Opcode.JUMPXEQKNIL, Opcode.JUMPXEQKB, Opcode.JUMPXEQKN, Opcode.JUMPXEQKS]);
const numericBinary = new Set([Opcode.ADD, Opcode.SUB, Opcode.MUL, Opcode.DIV, Opcode.MOD, Opcode.POW, Opcode.IDIV,
  Opcode.ADDK, Opcode.SUBK, Opcode.MULK, Opcode.DIVK, Opcode.MODK, Opcode.POWK, Opcode.IDIVK, Opcode.SUBRK, Opcode.DIVRK]);
const pureBody = new Set([Opcode.NOP, Opcode.MOVE, Opcode.LOADNIL, Opcode.LOADB, Opcode.LOADN, Opcode.LOADK, Opcode.LOADKX,
  Opcode.CAPTURE, Opcode.NEWCLOSURE, Opcode.DUPCLOSURE, Opcode.PREPVARARGS, Opcode.GETVARARGS, Opcode.RETURN,
  Opcode.GETUPVAL, Opcode.CLOSEUPVALS]);
const tableAccess = new Set([Opcode.GETTABLE, Opcode.GETTABLEKS, Opcode.GETTABLEN, Opcode.SETTABLE,
  Opcode.SETTABLEKS, Opcode.SETTABLEN, Opcode.SETLIST]);
