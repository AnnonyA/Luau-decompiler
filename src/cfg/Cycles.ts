import type {ControlFlowGraph} from './ControlFlowGraph.js';

/** Blocks in cyclic strongly connected components, including irreducible CFGs.
 * Iterative Kosaraju traversal keeps time linear and avoids host stack limits. */
export function findCyclicBlocks(cfg: ControlFlowGraph): Set<number> {
  const visited = new Set<number>(), order: number[] = [];
  for (const root of cfg.blocks) {
    if (root.unreachable || visited.has(root.id)) continue;
    visited.add(root.id);
    const stack = [{id: root.id, next: 0}];
    while (stack.length) {
      const frame = stack.at(-1)!;
      const successors = cfg.blocks[frame.id]!.successors;
      if (frame.next < successors.length) {
        const child = successors[frame.next++]!;
        if (!cfg.blocks[child]!.unreachable && !visited.has(child)) {
          visited.add(child);
          stack.push({id: child, next: 0});
        }
      } else {
        order.push(frame.id);
        stack.pop();
      }
    }
  }
  const assigned = new Set<number>(), cyclic = new Set<number>();
  for (const root of order.reverse()) {
    if (assigned.has(root)) continue;
    const component: number[] = [], pending = [root];
    assigned.add(root);
    while (pending.length) {
      const id = pending.pop()!;
      component.push(id);
      for (const parent of cfg.blocks[id]!.predecessors) {
        if (!cfg.blocks[parent]!.unreachable && !assigned.has(parent)) {
          assigned.add(parent);
          pending.push(parent);
        }
      }
    }
    if (component.length > 1 || cfg.blocks[root]!.successors.includes(root))
      for (const id of component) cyclic.add(id);
  }
  return cyclic;
}
