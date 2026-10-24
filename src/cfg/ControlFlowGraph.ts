import type { DecodedInstruction } from "../decode/DecodedInstruction.js";
import { Opcode, isFallthrough, isFastCall } from "../decode/Opcode.js";
import type { Prototype } from "../decode/Prototype.js";

export interface BasicBlock {
  id: number;
  startPc: number;
  endPc: number;
  instructions: DecodedInstruction[];
  successors: number[];
  predecessors: number[];
  fallthrough?: number;
  branch?: number;
  unreachable: boolean;
}

export interface ControlFlowGraph {
  prototype: Prototype;
  blocks: BasicBlock[];
  entry: number;
  exits: number[];
  blockOfPc: Map<number, number>;
}

export function buildControlFlowGraph(prototype: Prototype): ControlFlowGraph {
  const leaders = new Set<number>([0]);
  const instructions = prototype.instructions;
  for (const insn of instructions) {
    const structuralJump = insn.jumpTarget !== undefined && !isFastCall(insn.opcode);
    if (structuralJump && insn.jumpTarget! < prototype.code.length) {
      leaders.add(insn.jumpTarget!);
    }
    const next = insn.pc + insn.width;
    if (!isFallthrough(insn.opcode) || structuralJump) {
      // A terminator ends its basic block even when the compiler leaves an
      // unreachable jump after it. Including that jump would give RETURN a
      // successor, inventing loop backedges and executable continuation code.
      if (next < prototype.code.length) {
        leaders.add(next);
      }
    }
  }

  const starts = [...leaders].sort((a, b) => a - b);
  const blocks: BasicBlock[] = starts.map((startPc, id) => ({
    id,
    startPc,
    endPc: startPc,
    instructions: [],
    successors: [],
    predecessors: [],
    unreachable: false,
  }));

  const blockOfPc = new Map<number, number>();
  // Both block leaders and decoded instructions are ordered by program
  // counter. Walk the instruction stream once instead of rescanning it for
  // every basic block (which was quadratic for branch-heavy functions).
  let instructionIndex = 0;
  for (let i = 0; i < starts.length; i++) {
    const end = i + 1 < starts.length ? starts[i + 1]! : prototype.code.length;
    const block = blocks[i]!;
    block.endPc = end;
    while (instructionIndex < instructions.length && instructions[instructionIndex]!.pc < end) {
      const insn = instructions[instructionIndex++]!;
      block.instructions.push(insn);
      blockOfPc.set(insn.pc, i);
    }
  }

  for (const block of blocks) {
    const last = block.instructions[block.instructions.length - 1];
    if (!last) {
      continue;
    }
    const nextPc = last.pc + last.width;
    if (isFallthrough(last.opcode) && nextPc < prototype.code.length) {
      const nextBlock = blockOfPc.get(nextPc);
      if (nextBlock !== undefined) {
        block.fallthrough = nextBlock;
        addEdge(block, blocks[nextBlock]!);
      }
    }
    if (last.jumpTarget !== undefined && !isFastCall(last.opcode) && last.jumpTarget <= prototype.code.length) {
      if (last.jumpTarget === prototype.code.length) {
        continue;
      }
      const target = blockOfPc.get(last.jumpTarget);
      if (target !== undefined) {
        block.branch = target;
        addEdge(block, blocks[target]!);
      }
    }
  }

  const reachable = new Set<number>();
  const work: number[] = [0];
  while (work.length > 0) {
    const id = work.pop()!;
    if (reachable.has(id)) {
      continue;
    }
    reachable.add(id);
    for (const succ of blocks[id]?.successors ?? []) {
      work.push(succ);
    }
  }
  for (const block of blocks) {
    block.unreachable = !reachable.has(block.id);
  }

  return {
    prototype,
    blocks,
    entry: 0,
    exits: blocks.filter((block) => block.successors.length === 0 && !block.unreachable).map((block) => block.id),
    blockOfPc,
  };
}

function addEdge(from: BasicBlock, to: BasicBlock): void {
  if (!from.successors.includes(to.id)) {
    from.successors.push(to.id);
  }
  if (!to.predecessors.includes(from.id)) {
    to.predecessors.push(from.id);
  }
}

function isConditional(insn: DecodedInstruction): boolean {
  switch (insn.opcode) {
    case Opcode.JUMPIF:
    case Opcode.JUMPIFNOT:
    case Opcode.JUMPIFEQ:
    case Opcode.JUMPIFLE:
    case Opcode.JUMPIFLT:
    case Opcode.JUMPIFNOTEQ:
    case Opcode.JUMPIFNOTLE:
    case Opcode.JUMPIFNOTLT:
    case Opcode.JUMPXEQKNIL:
    case Opcode.JUMPXEQKB:
    case Opcode.JUMPXEQKN:
    case Opcode.JUMPXEQKS:
    case Opcode.LOADB:
    case Opcode.FORNPREP:
    case Opcode.FORNLOOP:
    case Opcode.FORGLOOP:
    case Opcode.CMPPROTO:
      return true;
    default:
      return false;
  }
}

export function successorBlocks(cfg: ControlFlowGraph, blockId: number): BasicBlock[] {
  return (cfg.blocks[blockId]?.successors ?? []).map((id) => cfg.blocks[id]!);
}

export function predecessorBlocks(cfg: ControlFlowGraph, blockId: number): BasicBlock[] {
  return (cfg.blocks[blockId]?.predecessors ?? []).map((id) => cfg.blocks[id]!);
}
