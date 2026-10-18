import type { ControlFlowGraph } from "../cfg/ControlFlowGraph.js";
import { DEFAULT_SAFETY_LIMITS } from "../safety/Limits.js";

export interface Liveness {
  liveIn: Set<number>[];
  liveOut: Set<number>[];
  uses: Map<number, number[]>;
  defs: Map<number, number[]>;
}

export function computeLiveness(cfg: ControlFlowGraph): Liveness {
  const n = cfg.blocks.length;
  const liveIn = Array.from({ length: n }, () => new Set<number>());
  const liveOut = Array.from({ length: n }, () => new Set<number>());
  const uses = new Map<number, number[]>();
  const defs = new Map<number, number[]>();

  const gen: Set<number>[] = [];
  const kill: Set<number>[] = [];
  for (const block of cfg.blocks) {
    const g = new Set<number>();
    const k = new Set<number>();
    for (const insn of block.instructions) {
      for (const register of insn.uses) {
        if (!k.has(register)) {
          g.add(register);
        }
        uses.set(register, [...(uses.get(register) ?? []), insn.pc]);
      }
      for (const register of insn.defs) {
        k.add(register);
        defs.set(register, [...(defs.get(register) ?? []), insn.pc]);
      }
    }
    gen.push(g);
    kill.push(k);
  }

  // Liveness only needs entry-reachable control flow. Keep each block in
  // the worklist at most once: backedges and converging branches otherwise
  // enqueue the same predecessor repeatedly and can exhaust the analysis
  // iteration limit before the fixed point is reached.
  const work = cfg.blocks.filter((block) => !block.unreachable).map((block) => block.id);
  const queued = new Set(work);
  let iterations = 0;
  while (work.length > 0) {
    if (++iterations > DEFAULT_SAFETY_LIMITS.maxAnalysisIterations) {
      break;
    }
    const id = work.pop()!;
    queued.delete(id);
    const out = new Set<number>();
    for (const succ of cfg.blocks[id]!.successors) {
      if (cfg.blocks[succ]?.unreachable) {
        continue;
      }
      for (const register of liveIn[succ]!) {
        out.add(register);
      }
    }
    liveOut[id] = out;
    const nextIn = new Set(gen[id]);
    for (const register of out) {
      if (!kill[id]!.has(register)) {
        nextIn.add(register);
      }
    }
    if (!sameSet(nextIn, liveIn[id]!)) {
      liveIn[id] = nextIn;
      for (const pred of cfg.blocks[id]!.predecessors) {
        if (!cfg.blocks[pred]?.unreachable && !queued.has(pred)) {
          queued.add(pred);
          work.push(pred);
        }
      }
    }
  }

  return { liveIn, liveOut, uses, defs };
}

function sameSet(a: Set<number>, b: Set<number>): boolean {
  if (a.size !== b.size) {
    return false;
  }
  for (const value of a) {
    if (!b.has(value)) {
      return false;
    }
  }
  return true;
}
