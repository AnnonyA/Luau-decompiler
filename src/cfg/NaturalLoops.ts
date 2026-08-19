import type { ControlFlowGraph } from "./ControlFlowGraph.js";
import type { DominatorTree } from "./Dominators.js";
import { Opcode } from "../decode/Opcode.js";

export interface NaturalLoop {
  header: number;
  backEdges: Array<{ from: number; to: number }>;
  blocks: number[];
  kind: "numeric-for" | "generic-for" | "repeat" | "while" | "infinite" | "unknown";
  latch: number;
  /** For `repeat ... until` loops whose exit test lives in the last body block
   * (before a pure back-edge latch), this is that test block. */
  testBlock?: number;
}

export function findNaturalLoops(cfg: ControlFlowGraph, dominators: DominatorTree): NaturalLoop[] {
  const loops: NaturalLoop[] = [];
  const seen = new Set<string>();
  for (const block of cfg.blocks) {
    for (const succ of block.successors) {
      if (!dominators.dominates(succ, block.id)) {
        // Generic-for loops are entered through FORGPREP which jumps directly to
        // the FORGLOOP latch, so the body start does not dominate the latch.
        if (!(block.instructions.at(-1)?.opcode === Opcode.FORGLOOP && succ === block.branch)) {
          continue;
        }
      }
      const key = `${succ}:${block.id}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
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
  loops.sort((a, b) => a.header - b.header || a.blocks.length - b.blocks.length);
  for (const loop of loops) {
    if (loop.kind === "repeat" && loop.header !== loop.latch) {
      loop.testBlock = findRepeatTestBlock(cfg, loop);
    }
  }
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
  // A pure back-edge latch (JUMPBACK only) with a conditional exit in the last
  // body block is a `repeat ... until` loop: the test is not in the header.
  // When the header itself holds the exit test (header === pre-latch), the loop
  // is still a repeat; otherwise a header test means `while`.
  if (latchLast?.opcode === Opcode.JUMPBACK || latchLast?.opcode === Opcode.JUMP) {
    const preLatch = findRepeatTestBlock(cfg, { header, latch });
    if (preLatch !== undefined) {
      // A pre-latch exit test with a pure back-edge latch is `repeat ... until`.
      // The header distinguishes the two shapes:
      //  - `repeat`: the test block is the header itself (body + test), or the
      //    header holds no conditional exit of its own.
      //  - `while`: the header holds the entry test; a pre-latch conditional is
      //    then just a trailing `if ... then break end` in the body.
      const headerBlock = cfg.blocks[header];
      const headerLast = headerBlock?.instructions.at(-1);
      const headerIsBareTest =
        headerLast !== undefined &&
        isConditionalJump(headerLast.opcode) &&
        (headerBlock?.instructions.length ?? 0) === 1;
      const headerExitsLoop =
        headerLast !== undefined &&
        isConditionalJump(headerLast.opcode) &&
        headerLast.jumpTarget !== undefined &&
        !loopBlocks(cfg, { header, latch }).has(headerLast.jumpTarget);
      if (preLatch === header) {
        // The header doubles as the test block: `repeat` unless it is a bare
        // test (then the body lives in the latch and this is a `while`).
        if (!headerIsBareTest) {
          return "repeat";
        }
      } else if (!headerExitsLoop) {
        return "repeat";
      }
    }
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

function findRepeatTestBlock(cfg: ControlFlowGraph, loop: Pick<NaturalLoop, "header" | "latch">): number | undefined {
  if (loop.header === loop.latch) {
    return undefined;
  }
  const latchBlock = cfg.blocks[loop.latch];
  if (!latchBlock) {
    return undefined;
  }
  // The test is in the latch itself when it conditionally jumps back to the header.
  const latchLast = latchBlock.instructions.at(-1);
  if (latchLast && isConditionalJump(latchLast.opcode)) {
    return loop.latch;
  }
  // Otherwise look for the last body block that jumps to the loop exit and
  // falls through into the pure back-edge latch — the `until` test position.
  // (A block whose conditional jumps to the latch is a `continue` guard, and a
  // block whose fallthrough leaves the loop is a `break` guard; neither is the
  // repeat test.)
  for (const pred of latchBlock.predecessors) {
    const block = cfg.blocks[pred];
    const last = block?.instructions.at(-1);
    if (!block || !last || !isConditionalJump(last.opcode)) {
      continue;
    }
    if (block.fallthrough === loop.latch && block.branch !== undefined && !loopBlocks(cfg, loop).has(block.branch)) {
      return pred;
    }
  }
  return undefined;
}

function loopBlocks(cfg: ControlFlowGraph, loop: Pick<NaturalLoop, "header" | "latch">): Set<number> {
  const blocks = new Set<number>([loop.header, loop.latch]);
  const stack = [loop.latch];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const pred of cfg.blocks[current]?.predecessors ?? []) {
      if (!blocks.has(pred)) {
        blocks.add(pred);
        stack.push(pred);
      }
    }
  }
  return blocks;
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
