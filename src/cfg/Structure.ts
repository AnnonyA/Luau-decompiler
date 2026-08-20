import type { ControlFlowGraph } from "./ControlFlowGraph.js";
import type { DominatorTree, PostDominatorTree } from "./Dominators.js";
import type { NaturalLoop } from "./NaturalLoops.js";

/**
 * Region-based control-flow structuring (Cifuentes 1993 / Phoenix 2013).
 *
 * Each 2-way branch is given a *follow* node — the first block that both arms
 * reach. Loops keep the follow computed from post-dominators. The reconstructor
 * uses these follows so `break` / `continue` / `if-then` line up with the
 * schemas a human wrote.
 */
export type RegionKind =
  | "if-then"
  | "if-then-else"
  | "while"
  | "repeat"
  | "infinite"
  | "numeric-for"
  | "generic-for"
  | "block"
  | "improper";

export interface StructuredRegion {
  kind: RegionKind;
  header: number;
  follow?: number;
  nodes: number[];
}

export interface StructureInfo {
  /** For every 2-successor block, the join that both arms reach. */
  ifFollow: Map<number, number>;
  /** Natural-loop header → first block after the loop. */
  loopFollow: Map<number, number>;
  regions: StructuredRegion[];
}

export function structureControlFlow(
  cfg: ControlFlowGraph,
  dominators: DominatorTree,
  postDominators: PostDominatorTree,
  loops: NaturalLoop[],
): StructureInfo {
  const ifFollow = computeIfFollows(cfg, postDominators);
  const loopFollow = new Map<number, number>();
  for (const loop of loops) {
    const follow = followOfLoop(cfg, postDominators, loop);
    if (follow !== undefined) {
      loopFollow.set(loop.header, follow);
    }
  }
  const regions = classifyRegions(cfg, ifFollow, loops, loopFollow);
  void dominators;
  return { ifFollow, loopFollow, regions };
}

/** Cifuentes: the follow of a 2-way node is its immediate post-dominator. */
export function computeIfFollows(cfg: ControlFlowGraph, postDominators: PostDominatorTree): Map<number, number> {
  const follows = new Map<number, number>();
  for (const block of cfg.blocks) {
    if (block.unreachable || block.successors.length !== 2) {
      continue;
    }
    const ipdom = postDominators.ipdom[block.id];
    if (ipdom !== undefined && ipdom >= 0 && ipdom < cfg.blocks.length && ipdom !== block.id) {
      follows.set(block.id, ipdom);
    }
  }
  return follows;
}

export function followOfLoop(
  cfg: ControlFlowGraph,
  postDominators: PostDominatorTree,
  loop: NaturalLoop,
): number | undefined {
  const ipdom = postDominators.ipdom[loop.header];
  if (ipdom !== undefined && ipdom >= 0 && ipdom < cfg.blocks.length && !loop.blocks.includes(ipdom) && ipdom !== loop.header) {
    return ipdom;
  }
  const outside: number[] = [];
  for (const id of loop.blocks) {
    for (const succ of cfg.blocks[id]?.successors ?? []) {
      if (!loop.blocks.includes(succ)) {
        outside.push(succ);
      }
    }
  }
  return outside.sort((a, b) => a - b)[0];
}

function classifyRegions(
  cfg: ControlFlowGraph,
  ifFollow: Map<number, number>,
  loops: NaturalLoop[],
  loopFollow: Map<number, number>,
): StructuredRegion[] {
  const regions: StructuredRegion[] = [];
  const claimed = new Set<number>();

  const sortedLoops = [...loops].sort((a, b) => a.blocks.length - b.blocks.length);
  for (const loop of sortedLoops) {
    const kind: RegionKind =
      loop.kind === "numeric-for" || loop.kind === "generic-for" || loop.kind === "while" || loop.kind === "repeat" || loop.kind === "infinite"
        ? loop.kind
        : "improper";
    regions.push({ kind, header: loop.header, follow: loopFollow.get(loop.header), nodes: loop.blocks });
    for (const id of loop.blocks) {
      claimed.add(id);
    }
  }

  for (const [header, follow] of ifFollow) {
    const block = cfg.blocks[header];
    if (!block || block.successors.length !== 2) {
      continue;
    }
    const [a, b] = block.successors;
    const thenIsFollow = a === follow || b === follow;
    regions.push({
      kind: thenIsFollow ? "if-then" : "if-then-else",
      header,
      follow,
      nodes: [header, ...block.successors.filter((id) => id !== follow)],
    });
  }

  for (const block of cfg.blocks) {
    if (block.unreachable || claimed.has(block.id) || ifFollow.has(block.id)) {
      continue;
    }
    if (block.successors.length <= 1) {
      regions.push({ kind: "block", header: block.id, follow: block.successors[0], nodes: [block.id] });
    }
  }

  return regions;
}
