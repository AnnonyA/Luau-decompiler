import type { Block, LocalDeclaration, Statement } from "../ast/Ast.js";
import { forEachIdentifier, rewriteBlocks } from "../ast/AstWalk.js";
import { buildControlFlowGraph, type ControlFlowGraph } from "../cfg/ControlFlowGraph.js";
import type { LocalDebugInfo, Prototype } from "../decode/Prototype.js";
import { analyzeBindings, type LexicalBinding } from "../analysis/Bindings.js";
import { normalizationSource } from "../decode/NormalizeControlFlow.js";

/** Luau starts every name in a parallel declaration after the complete RHS
 * list, not after that name's individual producer. Follow the one incoming
 * instruction chain to find those producers; never infer an initializer
 * across a branch, loop, or an ambiguous debug lifetime. */
export function parallelLocalDefinitions(proto: Prototype, cfg: ControlFlowGraph): ReadonlyMap<string, LocalDebugInfo> {
  const source = normalizationSource(proto);
  if (source !== proto) {
    const original = parallelLocalDefinitions(source, buildControlFlowGraph(source));
    const retained = new Map<string, LocalDebugInfo>();
    for (const instruction of proto.instructions) for (const register of instruction.defs) {
      const local = original.get(`${instruction.originalPc ?? instruction.pc}:${register}`);
      if (local) retained.set(`${instruction.pc}:${register}`, local);
    }
    return retained;
  }
  const groups = new Map<string, LocalDebugInfo[]>();
  for (const local of proto.locals) {
    if (local.startPc === 0 || local.startPc >= local.endPc) continue;
    const key = `${local.startPc}:${local.endPc}`;
    const group = groups.get(key) ?? [];
    group.push(local);
    groups.set(key, group);
  }
  const found = new Map<string, LocalDebugInfo>();
  const ambiguous = new Set<string>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    group.sort((a, b) => a.register - b.register);
    if (group.some((local, index) => index > 0 && local.register !== group[index - 1]!.register + 1)) continue;
    for (const local of group) {
      let id = cfg.blockOfPc.get(local.startPc);
      let limit = local.startPc;
      const seen = new Set<number>();
      let producer: number | undefined;
      while (id !== undefined && !seen.has(id)) {
        seen.add(id);
        const basic = cfg.blocks[id]!;
        if (basic.unreachable) break;
        for (let index = basic.instructions.length - 1; index >= 0; index--) {
          const instruction = basic.instructions[index]!;
          if (instruction.pc >= limit) continue;
          if (instruction.defs.includes(local.register)) {
            producer = instruction.pc;
            break;
          }
        }
        if (producer !== undefined) break;
        const predecessors = basic.predecessors.filter(parent => !cfg.blocks[parent]!.unreachable);
        if (predecessors.length !== 1) break;
        const parent = cfg.blocks[predecessors[0]!]!;
        if (parent.successors.length !== 1) break;
        id = parent.id;
        limit = Infinity;
      }
      if (producer === undefined) continue;
      const key = `${producer}:${local.register}`;
      if (found.has(key)) ambiguous.add(key);
      else found.set(key, local);
    }
  }
  for (const key of ambiguous) found.delete(key);
  return found;
}

/** Regroup only adjacent scalar definitions whose debug scopes identify one
 * source declaration. All values keep their order, and no initializer may
 * read a name whose declaration would move to the end of the RHS list. */
export function groupDebugDeclarations(body: Block): Block {
  const grouped = rewriteBlocks(body, block => {
    const statements: Statement[] = [];
    for (const statement of block.statements) {
      const previous = statements.at(-1);
      if (canJoin(previous, statement)) {
        const a = previous as LocalDeclaration, b = statement as LocalDeclaration;
        statements[statements.length - 1] = {
          ...a,
          names: [...a.names, ...b.names],
          values: [...a.values, ...b.values],
          ...(a.types || b.types ? {types: [...(a.types ?? a.names.map(() => undefined)), ...(b.types ?? b.names.map(() => undefined))]} : {}),
        };
      } else statements.push(statement);
    }
    return {...block, statements};
  });
  const declarations = new Map<LocalDeclaration, LexicalBinding[]>();
  for (const binding of analyzeBindings(grouped).bindings) {
    if (binding.declaration.kind !== "local") continue;
    const bindings = declarations.get(binding.declaration) ?? [];
    bindings.push(binding);
    declarations.set(binding.declaration, bindings);
  }
  return rewriteBlocks(grouped, block => {
    const statements: Statement[] = [];
    for (const statement of block.statements) {
      const previous = statements.at(-1);
      if (previous?.kind === "local" && statement.kind === "local" && statement.debugDeclaration &&
          previous.names.length > 1 && previous.names.length === statement.names.length &&
          previous.values.length === 1 && ["call", "method-call", "vararg"].includes(previous.values[0]!.kind) &&
          statement.values.length === statement.names.length) {
        const bindings = declarations.get(previous);
        if (bindings?.length === previous.names.length && bindings.every(binding => {
          const index = binding.declarationIndex!;
          return !binding.captured && binding.writes.length === 0 && binding.reads.length === 1 &&
            binding.reads[0]!.node === statement.values[index];
        })) {
          // The temporary tuple's only readers are this complete scalar copy.
          // Give its producer the source names directly, with the same requested
          // result count; no prefix or open tail is discarded or reopened.
          statements[statements.length - 1] = {...statement, values: previous.values};
          continue;
        }
      }
      statements.push(statement);
    }
    return {...block, statements};
  });
}

function canJoin(previous: Statement | undefined, next: Statement): boolean {
  if (previous?.kind !== "local" || next.kind !== "local" || !previous.debugDeclaration || !next.debugDeclaration) return false;
  const a = previous.debugDeclaration, b = next.debugDeclaration;
  if (a.prototypeId !== b.prototypeId || a.startPc !== b.startPc || a.endPc !== b.endPc ||
      b.register !== a.register + previous.names.length) return false;
  if (previous.names.length !== previous.values.length || next.names.length !== next.values.length) return false;
  const names = new Set([...previous.names, ...next.names]);
  if (names.size !== previous.names.length + next.names.length) return false;
  let reads = false;
  for (const expression of [...previous.values, ...next.values]) {
    forEachIdentifier(expression, name => { if (names.has(name)) reads = true; });
  }
  return !reads;
}
