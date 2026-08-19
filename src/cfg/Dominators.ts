import type { ControlFlowGraph } from "./ControlFlowGraph.js";

export interface DominatorTree {
  idom: number[];
  children: number[][];
  dominates: (a: number, b: number) => boolean;
  dominanceFrontier: number[][];
}

export interface PostDominatorTree {
  ipdom: number[];
  children: number[][];
  postDominates: (a: number, b: number) => boolean;
}

export function computeDominators(cfg: ControlFlowGraph): DominatorTree {
  const n = cfg.blocks.length;
  const idom = new Array<number>(n).fill(-1);
  const reachable = cfg.blocks.filter((block) => !block.unreachable).map((block) => block.id);
  if (reachable.length === 0) {
    return emptyTree(n);
  }

  const rpo = reversePostOrder(cfg, cfg.entry, (block) => block.successors);
  const indexOf = new Map<number, number>();
  rpo.forEach((id, index) => indexOf.set(id, index));
  idom[cfg.entry] = cfg.entry;

  let changed = true;
  while (changed) {
    changed = false;
    for (const id of rpo) {
      if (id === cfg.entry) {
        continue;
      }
      const preds = cfg.blocks[id]!.predecessors.filter((pred) => idom[pred] !== -1);
      if (preds.length === 0) {
        continue;
      }
      let newIdom = preds[0]!;
      for (let i = 1; i < preds.length; i++) {
        newIdom = intersect(preds[i]!, newIdom, idom, indexOf);
      }
      if (idom[id] !== newIdom) {
        idom[id] = newIdom;
        changed = true;
      }
    }
  }

  const children = Array.from({ length: n }, () => [] as number[]);
  for (const id of reachable) {
    if (id !== cfg.entry && idom[id] !== -1 && idom[id] !== id) {
      children[idom[id]!]!.push(id);
    }
  }

  const frontier = computeDominanceFrontiers(cfg, idom);
  return {
    idom,
    children,
    dominates: (a, b) => dominates(a, b, idom),
    dominanceFrontier: frontier,
  };
}

export function computePostDominators(cfg: ControlFlowGraph): PostDominatorTree {
  const n = cfg.blocks.length;
  const ipdom = new Array<number>(n).fill(-1);
  const exits = cfg.exits.length > 0 ? cfg.exits : cfg.blocks.filter((block) => !block.unreachable).map((b) => b.id);
  if (exits.length === 0) {
    return { ipdom, children: Array.from({ length: n }, () => []), postDominates: () => false };
  }

  const virtualExit = n;
  const successors = cfg.blocks.map((block) => [...block.predecessors]);
  const predecessors: number[][] = Array.from({ length: n + 1 }, () => []);
  for (const block of cfg.blocks) {
    for (const pred of block.predecessors) {
      predecessors[block.id]!.push(pred);
    }
  }
  for (const exit of exits) {
    successors[exit] = [...(cfg.blocks[exit]?.predecessors ?? [])];
  }

  const reversedSuccessors = cfg.blocks.map((block) => [...block.predecessors]);
  for (const exit of exits) {
    reversedSuccessors[exit]!.push(virtualExit);
  }

  const rpo: number[] = [];
  const seen = new Set<number>([virtualExit]);
  const visit = (id: number): void => {
    for (const succ of id === virtualExit ? exits : (cfg.blocks[id]?.predecessors ?? [])) {
      if (!seen.has(succ)) {
        seen.add(succ);
        visit(succ);
      }
    }
    if (id !== virtualExit) {
      rpo.push(id);
    }
  };
  visit(virtualExit);
  rpo.reverse();

  const indexOf = new Map<number, number>();
  rpo.forEach((id, index) => indexOf.set(id, index));
  const working = new Array<number>(n).fill(-1);

  let changed = true;
  while (changed) {
    changed = false;
    for (const id of rpo) {
      const succs = cfg.blocks[id]!.successors;
      const candidates = succs.length === 0 ? [] : succs.filter((succ) => working[succ] !== -1 || succs.length === 0);
      const seeds = succs.length === 0 ? [id] : candidates;
      if (seeds.length === 0 && succs.length === 0) {
        if (working[id] !== id) {
          working[id] = id;
          changed = true;
        }
        continue;
      }
      if (seeds.length === 0) {
        continue;
      }
      let newIdom = seeds[0]!;
      for (let i = 1; i < seeds.length; i++) {
        newIdom = intersect(seeds[i]!, newIdom, working, indexOf);
      }
      if (working[id] !== newIdom) {
        working[id] = newIdom;
        changed = true;
      }
    }
  }

  const children = Array.from({ length: n }, () => [] as number[]);
  for (let id = 0; id < n; id++) {
    ipdom[id] = working[id] ?? -1;
    if (ipdom[id] !== -1 && ipdom[id] !== id) {
      children[ipdom[id]!]!.push(id);
    }
  }
  return {
    ipdom,
    children,
    postDominates: (a, b) => dominates(a, b, ipdom),
  };
}

function emptyTree(n: number): DominatorTree {
  return {
    idom: new Array(n).fill(-1),
    children: Array.from({ length: n }, () => []),
    dominates: () => false,
    dominanceFrontier: Array.from({ length: n }, () => []),
  };
}

function reversePostOrder(
  cfg: ControlFlowGraph,
  start: number,
  next: (block: { successors: number[]; predecessors: number[] }) => number[],
): number[] {
  const seen = new Set<number>();
  const order: number[] = [];
  const visit = (id: number): void => {
    if (seen.has(id)) {
      return;
    }
    seen.add(id);
    const block = cfg.blocks[id];
    if (!block) {
      return;
    }
    for (const succ of next(block)) {
      visit(succ);
    }
    order.push(id);
  };
  visit(start);
  return order.reverse();
}

function intersect(b1: number, b2: number, idom: number[], indexOf: Map<number, number>): number {
  let finger1 = b1;
  let finger2 = b2;
  while (finger1 !== finger2) {
    while ((indexOf.get(finger1) ?? Infinity) > (indexOf.get(finger2) ?? Infinity)) {
      finger1 = idom[finger1]!;
      if (finger1 === -1) {
        return finger2;
      }
    }
    while ((indexOf.get(finger2) ?? Infinity) > (indexOf.get(finger1) ?? Infinity)) {
      finger2 = idom[finger2]!;
      if (finger2 === -1) {
        return finger1;
      }
    }
  }
  return finger1;
}

function dominates(a: number, b: number, idom: number[]): boolean {
  if (a === b) {
    return true;
  }
  let current = b;
  const seen = new Set<number>();
  while (current !== -1 && !seen.has(current)) {
    seen.add(current);
    if (current === a) {
      return true;
    }
    if (idom[current] === current) {
      return a === current;
    }
    current = idom[current]!;
  }
  return false;
}

function computeDominanceFrontiers(cfg: ControlFlowGraph, idom: number[]): number[][] {
  const frontier = cfg.blocks.map(() => [] as number[]);
  for (const block of cfg.blocks) {
    if (block.predecessors.length < 2) {
      continue;
    }
    for (const pred of block.predecessors) {
      let runner = pred;
      while (runner !== -1 && runner !== idom[block.id]) {
        if (!frontier[runner]!.includes(block.id)) {
          frontier[runner]!.push(block.id);
        }
        runner = idom[runner]!;
      }
    }
  }
  return frontier;
}
