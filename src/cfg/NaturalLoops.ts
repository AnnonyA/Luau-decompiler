import type { ControlFlowGraph } from "./ControlFlowGraph.js";
import type { DominatorTree } from "./Dominators.js";
import { Opcode } from "../decode/Opcode.js";

export interface NaturalLoop {
  header: number;
  backEdges: Array<{ from: number; to: number }>;
  blocks: number[];
  kind: "numeric-for" | "generic-for" | "repeat" | "while" | "infinite" | "unknown";
  latch: number;
}

export function findNaturalLoops(cfg: ControlFlowGraph, dominators: DominatorTree): NaturalLoop[] {
  const loops: NaturalLoop[] = [];
  for (const block of cfg.blocks) {
    for (const succ of block.successors) {
      if (dominators.dominates(succ, block.id)) {
        const body = collectLoopBody(cfg, succ, block.id);
        loops.push({
          header: succ,
          backEdges: [{ from: block.id, to: succ }],
          blocks: body,
          kind: classifyLoop(cfg, succ, block.id, body),
          latch: block.id,
        });
      }
    }
  }
  loops.sort((a, b) => a.header - b.header || a.blocks.length - b.blocks.length);
  return loops;
}

function collectLoopBody(cfg: ControlFlowGraph, header: number, latch: number): number[] {
  const body = new Set<number>([header, latch]);
  const stack = [latch];
  while (stack.length > 0) {
    const id = stack.pop()!;
    for (const pred of cfg.blocks[id]?.predecessors ?? []) {
      if (!body.has(pred)) {
        body.add(pred);
        stack.push(pred);
      }
    }
  }
  return [...body].sort((a, b) => a - b);
}

function classifyLoop(cfg: ControlFlowGraph, header: number, latch: number, _body: number[]): NaturalLoop["kind"] {
  const headerInsn = cfg.blocks[header]?.instructions[0];
  const latchLast = cfg.blocks[latch]?.instructions.at(-1);
  if (headerInsn?.opcode === Opcode.FORNLOOP || latchLast?.opcode === Opcode.FORNLOOP) {
    return "numeric-for";
  }
  if (headerInsn?.opcode === Opcode.FORGLOOP || latchLast?.opcode === Opcode.FORGLOOP) {
    return "generic-for";
  }
  if (latchLast?.opcode === Opcode.JUMPBACK && header === latch) {
    return "infinite";
  }
  if (header === latch && latchLast && isConditionalJump(latchLast.opcode)) {
    return "repeat";
  }
  const headerLast = cfg.blocks[header]?.instructions.at(-1);
  if (headerLast && isConditionalJump(headerLast.opcode) && headerLast.jumpTarget !== undefined) {
    return "while";
  }
  if (latchLast && isConditionalJump(latchLast.opcode)) {
    return "repeat";
  }
  return "unknown";
}

function isConditionalJump(opcode: Opcode): boolean {
  switch (opcode) {
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
      return true;
    default:
      return false;
  }
}
