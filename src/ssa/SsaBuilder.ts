import type { ControlFlowGraph } from "../cfg/ControlFlowGraph.js";
import type { DominatorTree } from "../cfg/Dominators.js";
import { computeLiveness } from "../dataflow/Liveness.js";
import { effectOf } from "../analysis/SideEffects.js";
import { CaptureType, Opcode } from "../decode/Opcode.js";
import type { DecodedInstruction } from "../decode/DecodedInstruction.js";
import type { PhiNode, SsaOp, SsaValue, ValueClass } from "./SsaValue.js";

export interface SsaFunction {
  values: SsaValue[];
  phis: Map<number, PhiNode[]>;
  defAt: Map<string, number>;
  blockValues: Map<number, number[]>;
  registerAt: Map<string, number>;
}

export function buildSsa(cfg: ControlFlowGraph, dominators: DominatorTree): SsaFunction {
  const liveness = computeLiveness(cfg);
  const values: SsaValue[] = [];
  const phis = new Map<number, PhiNode[]>();
  const defsByRegister = new Map<number, number[]>();

  const addValue = (
    register: number,
    block: number,
    pc: number,
    op: SsaOp,
    classification: ValueClass,
    instruction?: DecodedInstruction,
  ): SsaValue => {
    const version = (defsByRegister.get(register) ?? []).length + 1;
    const value: SsaValue = {
      id: values.length,
      register,
      version,
      block,
      pc,
      op,
      classification,
      sideEffect: instruction ? effectOf(instruction) : "pure",
      uses: [],
      instruction,
    };
    values.push(value);
    defsByRegister.set(register, [...(defsByRegister.get(register) ?? []), value.id]);
    return value;
  };

  for (let register = 0; register < cfg.prototype.numParams; register++) {
    addValue(register, cfg.entry, -1, { kind: "parameter", index: register }, "parameter");
  }

  const phiByBlockReg = new Map<string, PhiNode>();
  for (const [register, sites] of defsByRegisterFromCfg(cfg)) {
    const work = [...sites];
    const placed = new Set<number>();
    while (work.length > 0) {
      const blockId = work.pop()!;
      for (const frontier of dominators.dominanceFrontier[blockId] ?? []) {
        if (placed.has(frontier)) {
          continue;
        }
        if (!liveness.liveIn[frontier]?.has(register)) {
          continue;
        }
        placed.add(frontier);
        const value = addValue(register, frontier, cfg.blocks[frontier]!.startPc, { kind: "phi", operands: [] }, "phi");
        const phi: PhiNode = { value: value.id, register, block: frontier, operands: [] };
        const list = phis.get(frontier) ?? [];
        list.push(phi);
        phis.set(frontier, list);
        phiByBlockReg.set(`${frontier}:${register}`, phi);
        work.push(frontier);
      }
    }
  }

  const current = new Map<number, number>();
  for (const value of values) {
    if (value.op.kind === "parameter") {
      current.set(value.register, value.id);
    }
  }
  const stack: Map<number, number>[] = [];
  const defAt = new Map<string, number>();
  const blockValues = new Map<number, number[]>();

  const lookup = (register: number, block: number, pc: number): number => {
    const existing = current.get(register);
    if (existing !== undefined) {
      return existing;
    }
    const value = addValue(register, block, pc, { kind: "undefined" }, "synthetic");
    current.set(register, value.id);
    return value.id;
  };

  const rename = (blockId: number): void => {
    const snapshot = new Map(current);
    stack.push(snapshot);
    const defined: number[] = [];
    for (const phi of phis.get(blockId) ?? []) {
      current.set(phi.register, phi.value);
      defined.push(phi.value);
    }

    for (const insn of cfg.blocks[blockId]!.instructions) {
      const produced = lowerInstruction(insn, (register) => lookup(register, blockId, insn.pc));
      for (const use of produced.uses) {
        values[use]?.uses.push(insn.pc);
      }
      produced.defs.forEach((def, index) => {
        const register = insn.defs[index] ?? insn.a;
        const value = addValue(register, blockId, insn.pc, def, classify(insn, index), insn);
        current.set(register, value.id);
        defined.push(value.id);
        defAt.set(`${blockId}:${insn.pc}:${register}`, value.id);
      });
    }

    blockValues.set(blockId, defined);

    for (const succ of cfg.blocks[blockId]!.successors) {
      for (const phi of phis.get(succ) ?? []) {
        const incoming = lookup(phi.register, blockId, cfg.blocks[blockId]!.endPc);
        phi.operands.push({ pred: blockId, value: incoming });
        const phiValue = values[phi.value];
        if (phiValue && phiValue.op.kind === "phi") {
          phiValue.op.operands.push({ pred: blockId, value: incoming });
        }
        values[incoming]?.uses.push(phi.value);
      }
    }

    for (const child of dominators.children[blockId] ?? []) {
      rename(child);
    }

    const restore = stack.pop();
    current.clear();
    if (restore) {
      for (const [register, id] of restore) {
        current.set(register, id);
      }
    }
  };

  rename(cfg.entry);

  const registerAt = new Map<string, number>();
  for (const value of values) {
    registerAt.set(`${value.block}:${value.pc}:${value.register}`, value.id);
  }

  return { values, phis, defAt, blockValues, registerAt };
}

function defsByRegisterFromCfg(cfg: ControlFlowGraph): Map<number, number[]> {
  const map = new Map<number, number[]>();
  for (let register = 0; register < cfg.prototype.numParams; register++) {
    map.set(register, [cfg.entry]);
  }
  for (const block of cfg.blocks) {
    for (const insn of block.instructions) {
      for (const register of insn.defs) {
        map.set(register, [...(map.get(register) ?? []), block.id]);
      }
    }
  }
  return map;
}

function classify(insn: DecodedInstruction, resultIndex: number): ValueClass {
  switch (insn.opcode) {
    case Opcode.CALL:
    case Opcode.CALLFB:
    case Opcode.GETVARARGS:
      return "call-result";
    case Opcode.FORNLOOP:
    case Opcode.FORGLOOP:
      return resultIndex === 0 ? "iterator-state" : "source-local";
    case Opcode.MOVE:
    case Opcode.LOADK:
    case Opcode.LOADN:
    case Opcode.LOADB:
    case Opcode.LOADNIL:
    case Opcode.LOADKX:
      return "temporary";
    default:
      return "temporary";
  }
}

interface Lowered {
  uses: number[];
  defs: SsaOp[];
}

function lowerInstruction(insn: DecodedInstruction, read: (register: number) => number): Lowered {
  const uses: number[] = insn.uses.map(read);
  const r = (index: number): number => uses[index] ?? read(insn.uses[index] ?? insn.a);

  switch (insn.opcode) {
    case Opcode.LOADNIL:
      return { uses, defs: [{ kind: "immediate", value: null }] };
    case Opcode.LOADB:
      return { uses, defs: [{ kind: "immediate", value: insn.b !== 0 }] };
    case Opcode.LOADN:
      return { uses, defs: [{ kind: "immediate", value: insn.d }] };
    case Opcode.LOADK:
      return { uses, defs: [{ kind: "constant", constantIndex: insn.d }] };
    case Opcode.LOADKX:
      return { uses, defs: [{ kind: "constant", constantIndex: insn.aux ?? 0 }] };
    case Opcode.MOVE:
      return { uses, defs: [{ kind: "move", source: r(0) }] };
    case Opcode.GETGLOBAL:
      return { uses, defs: [{ kind: "global", nameIndex: insn.aux ?? 0, write: false }] };
    case Opcode.SETGLOBAL:
      return { uses, defs: [] };
    case Opcode.GETUPVAL:
      return { uses, defs: [{ kind: "upvalue", index: insn.b, write: false }] };
    case Opcode.SETUPVAL:
      return { uses, defs: [] };
    case Opcode.GETIMPORT:
      return { uses, defs: [{ kind: "import", constantIndex: insn.d }] };
    case Opcode.GETTABLE:
      return { uses, defs: [{ kind: "table-get", table: r(0), key: r(1) }] };
    case Opcode.GETTABLEKS:
    case Opcode.GETUDATAKS:
      return { uses, defs: [{ kind: "table-get", table: r(0), key: { constantIndex: insn.constantIndex ?? 0 } }] };
    case Opcode.GETTABLEN:
      return { uses, defs: [{ kind: "table-get", table: r(0), key: { integer: insn.c + 1 } }] };
    case Opcode.NEWTABLE:
      return { uses, defs: [{ kind: "new-table", hashLog: insn.b, arraySize: insn.aux ?? 0 }] };
    case Opcode.DUPTABLE:
      return { uses, defs: [{ kind: "dup-table", constantIndex: insn.d }] };
    case Opcode.ADD:
    case Opcode.SUB:
    case Opcode.MUL:
    case Opcode.DIV:
    case Opcode.MOD:
    case Opcode.POW:
    case Opcode.IDIV:
    case Opcode.AND:
    case Opcode.OR:
      return { uses, defs: [{ kind: "binary", op: binaryOp(insn.opcode), left: r(0), right: r(1) }] };
    case Opcode.ADDK:
    case Opcode.SUBK:
    case Opcode.MULK:
    case Opcode.DIVK:
    case Opcode.MODK:
    case Opcode.POWK:
    case Opcode.IDIVK:
    case Opcode.ANDK:
    case Opcode.ORK:
      return {
        uses,
        defs: [{ kind: "binary", op: binaryOp(insn.opcode), left: r(0), right: -(insn.constantIndex ?? 0) - 1 }],
      };
    case Opcode.SUBRK:
    case Opcode.DIVRK:
      return {
        uses,
        defs: [{ kind: "binary", op: binaryOp(insn.opcode), left: -(insn.constantIndex ?? 0) - 1, right: r(0) }],
      };
    case Opcode.NOT:
    case Opcode.MINUS:
    case Opcode.LENGTH:
      return { uses, defs: [{ kind: "unary", op: unaryOp(insn.opcode), operand: r(0) }] };
    case Opcode.CONCAT:
      return { uses, defs: [{ kind: "concat", operands: uses }] };
    case Opcode.NAMECALL:
    case Opcode.NAMECALLUDATA:
      return {
        uses,
        defs: [
          { kind: "namecall", object: r(0), nameIndex: insn.constantIndex ?? 0 },
          { kind: "move", source: r(0) },
        ],
      };
    case Opcode.CALL:
    case Opcode.CALLFB: {
      const argCount = insn.call?.argumentCount === "multret" ? uses.length - 1 : (insn.call?.argumentCount ?? 0);
      const resultCount = insn.call?.resultCount === "multret" ? 1 : (insn.call?.resultCount ?? 0);
      const callee = uses[0] ?? r(0);
      const args = uses.slice(1, 1 + Math.max(argCount, 0));
      const defs: SsaOp[] = [];
      for (let i = 0; i < Math.max(resultCount, insn.defs.length); i++) {
        defs.push({
          kind: "call",
          callee,
          args,
          argOpen: insn.call?.argumentCount === "multret",
          results: resultCount,
          resultOpen: insn.call?.resultCount === "multret",
        });
      }
      return { uses, defs };
    }
    case Opcode.GETVARARGS:
      return {
        uses,
        defs: insn.defs.map(() => ({
          kind: "vararg",
          count: insn.b === 0 ? "multret" : insn.b - 1,
        })),
      };
    case Opcode.NEWCLOSURE:
      return {
        uses,
        defs: [{ kind: "closure", protoIndex: insn.protoIndex ?? 0, captures: [] }],
      };
    case Opcode.DUPCLOSURE:
      return { uses, defs: [{ kind: "constant", constantIndex: insn.d }] };
    case Opcode.FORNLOOP:
    case Opcode.FORNPREP:
      return { uses, defs: insn.defs.map(() => ({ kind: "for-index" })) };
    case Opcode.FORGLOOP:
      return { uses, defs: insn.defs.map(() => ({ kind: "for-index" })) };
    default:
      return { uses, defs: insn.defs.map(() => ({ kind: "unknown", opcode: insn.opcode })) };
  }
}

function binaryOp(opcode: Opcode): string {
  switch (opcode) {
    case Opcode.ADD:
    case Opcode.ADDK:
      return "+";
    case Opcode.SUB:
    case Opcode.SUBK:
    case Opcode.SUBRK:
      return "-";
    case Opcode.MUL:
    case Opcode.MULK:
      return "*";
    case Opcode.DIV:
    case Opcode.DIVK:
    case Opcode.DIVRK:
      return "/";
    case Opcode.MOD:
    case Opcode.MODK:
      return "%";
    case Opcode.POW:
    case Opcode.POWK:
      return "^";
    case Opcode.IDIV:
    case Opcode.IDIVK:
      return "//";
    case Opcode.AND:
    case Opcode.ANDK:
      return "and";
    case Opcode.OR:
    case Opcode.ORK:
      return "or";
    default:
      return "?";
  }
}

function unaryOp(opcode: Opcode): string {
  switch (opcode) {
    case Opcode.NOT:
      return "not";
    case Opcode.MINUS:
      return "-";
    case Opcode.LENGTH:
      return "#";
    default:
      return "?";
  }
}

export { CaptureType };
