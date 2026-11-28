import {effectOf} from "../analysis/SideEffects.js";
import type {BasicBlock} from "../cfg/ControlFlowGraph.js";
import type {Liveness} from "../dataflow/Liveness.js";
import {Opcode} from "../decode/Opcode.js";
import type {FunctionIr} from "./Reconstructor.js";

const comparisons = new Set([
  Opcode.JUMPIF, Opcode.JUMPIFNOT, Opcode.JUMPIFEQ, Opcode.JUMPIFLE, Opcode.JUMPIFLT,
  Opcode.JUMPIFNOTEQ, Opcode.JUMPIFNOTLE, Opcode.JUMPIFNOTLT,
  Opcode.JUMPXEQKNIL, Opcode.JUMPXEQKB, Opcode.JUMPXEQKN, Opcode.JUMPXEQKS,
]);
const expressionInstructions = new Set([
  Opcode.NOP, Opcode.LOADNIL, Opcode.LOADB, Opcode.LOADN, Opcode.LOADK, Opcode.LOADKX,
  Opcode.MOVE, Opcode.GETUPVAL, Opcode.GETGLOBAL, Opcode.GETIMPORT,
  Opcode.GETTABLE, Opcode.GETTABLEKS, Opcode.GETTABLEN,
  Opcode.NOT, Opcode.MINUS, Opcode.LENGTH, Opcode.ADD, Opcode.SUB, Opcode.MUL, Opcode.DIV,
  Opcode.MOD, Opcode.POW, Opcode.IDIV, Opcode.ADDK, Opcode.SUBK, Opcode.MULK, Opcode.DIVK,
  Opcode.MODK, Opcode.POWK, Opcode.IDIVK, Opcode.SUBRK, Opcode.DIVRK,
  Opcode.AND, Opcode.OR, Opcode.ANDK, Opcode.ORK, Opcode.CONCAT,
]);
const stateBoundaries = new Set([
  Opcode.CAPTURE, Opcode.CLOSEUPVALS, Opcode.NEWCLOSURE, Opcode.DUPCLOSURE, Opcode.SETUPVAL,
  Opcode.GETVARARGS, Opcode.PREPVARARGS, Opcode.FORNPREP, Opcode.FORNLOOP, Opcode.FORGPREP,
  Opcode.FORGPREP_INEXT, Opcode.FORGPREP_NEXT, Opcode.FORGLOOP, Opcode.JUMPBACK,
]);

/** One arm enters the same original body block as a second conditional arm.
 * The latter's other edge is the existing follow, so an OR test can select
 * that single body without duplicating it or moving its work. */
export function sharedGuardShape(
  ir: FunctionIr, basic: BasicBlock, follow: number, liveness: Liveness,
): {guard: BasicBlock; body: BasicBlock} | undefined {
  if (basic.successors.length !== 2 || !ir.cfg.blocks[follow]) return undefined;
  for (const guardId of basic.successors) {
    const bodyId = basic.successors.find(id => id !== guardId)!;
    if (new Set([basic.id, guardId, bodyId, follow]).size !== 4) continue;
    const guard = ir.cfg.blocks[guardId]!, body = ir.cfg.blocks[bodyId]!;
    const last = guard.instructions.at(-1);
    if (!last || !comparisons.has(last.opcode) || guard.successors.length !== 2 ||
        !guard.successors.includes(bodyId) || !guard.successors.includes(follow) ||
        body.successors.length !== 1 || body.successors[0] !== follow) continue;
    if ([guard, body].some(block => block.unreachable || !ir.dominators.dominates(basic.id, block.id) ||
        ir.loops.some(loop => loop.header === block.id) || (ir.ssa.phis.get(block.id)?.length ?? 0) > 0)) continue;
    if (guard.predecessors.some(id => !ir.cfg.blocks[id]?.unreachable && id !== basic.id) ||
        body.predecessors.some(id => !ir.cfg.blocks[id]?.unreachable && id !== basic.id && id !== guardId)) continue;
    if (guard.instructions.length > 32 || body.instructions.length > 256 ||
        guard.instructions.slice(0, -1).some(insn => !expressionInstructions.has(insn.opcode))) continue;
    const followPhis = new Set((ir.ssa.phis.get(follow) ?? []).map(phi => phi.register));
    if (guard.instructions.some(insn => insn.defs.some(register => liveness.liveOut[guardId]?.has(register))) ||
        [...guard.instructions, ...body.instructions].some(insn =>
          insn.defs.some(register => followPhis.has(register)))) continue;
    if (body.instructions.some(insn => stateBoundaries.has(insn.opcode) || effectOf(insn) === "unknown" ||
        ((insn.opcode === Opcode.CALL || insn.opcode === Opcode.CALLFB) && (insn.b === 0 || insn.c === 0)))) continue;
    return {guard, body};
  }
  return undefined;
}
