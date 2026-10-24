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
    // Dead code is not part of the entry-reachable control-flow regions.
    if (block.unreachable) {
      continue;
    }
    for (const succ of block.successors) {
      if (cfg.blocks[succ]?.unreachable) {
        continue;
      }
      if (!dominators.dominates(succ, block.id)) {
        // Generic-for loops are entered through FORGPREP which jumps directly to
        // the FORGLOOP latch, so the body start does not dominate the latch.
        if (!(block.instructions.at(-1)?.opcode === Opcode.FORGLOOP && succ === block.branch && succ < block.id)) {
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
  // Several continue paths may branch back to the same loop header. They
  // describe ONE natural loop, not separate nested loops with identical
  // headers. Merge their bodies and retain all backedges for downstream SSA.
  const byHeader = new Map<string, NaturalLoop>();
  for (const loop of loops) {
    // A for-loop's iteration edge and an inner while backedge can target
    // the same first body block. They own different iteration machinery and
    // must not be collapsed merely because their headers coincide.
    const latchOpcode = cfg.blocks[loop.latch]?.instructions.at(-1)?.opcode;
    const iterationEdge = latchOpcode === Opcode.FORGLOOP || latchOpcode === Opcode.FORNLOOP;
    const key = `${loop.header}:${iterationEdge ? loop.latch : "natural"}`;
    const existing = byHeader.get(key);
    if (!existing) {
      byHeader.set(key, loop);
      continue;
    }
    existing.backEdges.push(...loop.backEdges);
    existing.blocks = [...new Set([...existing.blocks, ...loop.blocks])].sort((a, b) => a - b);
    if (isPreferredLatch(cfg, loop.latch, existing.latch)) {
      existing.latch = loop.latch;
    }
  }

  const merged = [...byHeader.values()].sort((a, b) => a.header - b.header);
  // Reverse collection stops at the header. When a for body begins with
  // another loop, include that loop's backedge region as well: otherwise
  // the outer region can appear smaller than its own first statement.
  for (const outer of merged) {
    const opcode = cfg.blocks[outer.latch]?.instructions.at(-1)?.opcode;
    if (opcode !== Opcode.FORGLOOP && opcode !== Opcode.FORNLOOP) continue;
    const nested = merged.filter(inner => inner !== outer && inner.header === outer.header &&
      !inner.blocks.includes(outer.latch));
    outer.blocks = [...new Set([...outer.blocks, ...nested.flatMap(inner => inner.blocks)])].sort((a, b) => a - b);
  }
  for (const loop of merged) {
    loop.kind = classifyLoop(cfg, loop.header, loop.latch, loop.blocks);
    if (loop.kind === "repeat" && loop.header !== loop.latch) {
      loop.testBlock = findRepeatTestBlock(cfg, loop);
    }
  }
  return merged;
}

function isPreferredLatch(cfg: ControlFlowGraph, candidate: number, current: number): boolean {
  const score = (id: number): number => {
    const opcode = cfg.blocks[id]?.instructions.at(-1)?.opcode;
    return opcode === Opcode.FORNLOOP || opcode === Opcode.FORGLOOP ? 2 : 0;
  };
  const next = score(candidate);
  const previous = score(current);
  return next > previous || (next === previous && cfg.blocks[candidate]!.startPc > cfg.blocks[current]!.startPc);
}

function collectLoopBody(cfg: ControlFlowGraph, header: number, latch: number): number[] {
  // A self-loop consists only of its header. Walking predecessors of the
  // header would incorrectly pull in the preheader and earlier statements.
  if (header === latch) {
    return [header];
  }
  const body = new Set<number>([header, latch]);
  const stack = [latch];
  while (stack.length > 0) {
    const id = stack.pop()!;
    for (const pred of cfg.blocks[id]?.predecessors ?? []) {
      // Generic loops enter at FORGLOOP through FORGPREP. That entry edge
      // is not a backedge: following it backwards absorbs enclosing loops.
      if (id === latch && isGenericEntry(cfg, pred, latch)) {
        continue;
      }
      if (!cfg.blocks[pred]?.unreachable && !body.has(pred)) {
        body.add(pred);
        stack.push(pred);
      }
    }
  }
  return [...body].sort((a, b) => a - b);
}

function isGenericEntry(cfg: ControlFlowGraph, predecessor: number, latch: number): boolean {
  const last = cfg.blocks[predecessor]?.instructions.at(-1);
  return last !== undefined &&
    (last.opcode === Opcode.FORGPREP || last.opcode === Opcode.FORGPREP_INEXT || last.opcode === Opcode.FORGPREP_NEXT) &&
    last.jumpTarget === cfg.blocks[latch]?.startPc;
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
        headerBlock?.branch !== undefined &&
        !loopBlocks(cfg, { header, latch }).has(headerBlock.branch);
      if (preLatch === header) {
        // A while-header may load the comparison constant before its test,
        // e.g. LOADK 5; JUMPIFNOTLE index, 5. It is not a bare test, but the
        // following latch contains the real loop body (ADD/MOVE/...). Treat
        // this as a while, otherwise emission turns it into an empty repeat
        // and drops the register updates, creating an infinite loop.
        //
        // A repeat loop whose body and exit test are in the header instead
        // has a control-only latch (just the backedge); keep that shape.
        const latchHasBody = cfg.blocks[latch]!.instructions.some((insn) =>
          insn.opcode !== Opcode.JUMPBACK &&
          insn.opcode !== Opcode.JUMP &&
          insn.opcode !== Opcode.NOP
        );
        if (!headerIsBareTest && !(headerExitsLoop && latchHasBody)) {
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
      if (current === loop.latch && isGenericEntry(cfg, pred, loop.latch)) {
        continue;
      }
      if (!cfg.blocks[pred]?.unreachable && !blocks.has(pred)) {
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
