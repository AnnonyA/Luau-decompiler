import { analyzeBindings, type LexicalBinding } from "../analysis/Bindings.js";
import type { Block, Chunk, Expression, FunctionExpression, Statement } from "../ast/Ast.js";
import { block, ident, lit } from "../ast/Ast.js";
import { forEachDeclaredName, forEachIdentifier, rewriteBlocks } from "../ast/AstWalk.js";
import { Opcode } from "../decode/Opcode.js";
import type { BytecodeModule } from "../decode/Prototype.js";
import { NameAllocator } from "./Naming.js";
import { rewriteRegisterCount } from "./RegisterBudget.js";
import { namedClosureDeclaration } from "./ClosureNames.js";

type Load = { index: number; statement: Statement; fn: FunctionExpression; key: string };

/** Keep a native closure constant in its original executing function. A
 * carrier function cannot do this across a change to the owner's environment:
 * its own environment would retain the previous value. A small dispatcher
 * shares one physical literal while leaving all intervening user statements
 * in the original activation and in their original order.
 *
 * This lowering is intentionally bounded. Every load of a selected slot must
 * be a direct statement in this block. Hoisted locals must be uncaptured,
 * unambiguous bindings, and no break/continue may target an enclosing loop. */
export function lowerClosureIdentity(ast: Chunk, module: BytecodeModule): {
  ast: Chunk; resolvedKeys: ReadonlySet<string>;
} {
  const inventory = new Set<string>();
  forEachDeclaredName(ast.body, name => inventory.add(name));
  forEachIdentifier(ast.body, name => inventory.add(name));
  // A named literal may have no same-spelled storage binding yet. Its
  // exact-name declaration must never shadow the generated result cell.
  visitObjects(ast.body, node => {
    const value = node as Expression;
    if (value.kind === "function-expr" && value.debugName) inventory.add(value.debugName);
  });
  const names = new NameAllocator(inventory);
  const expected = new Map<string, number>();
  for (const proto of module.prototypes) for (const insn of proto.instructions) {
    if (insn.opcode !== Opcode.DUPCLOSURE) continue;
    const constant = proto.constants[insn.d];
    if (constant?.kind !== "closure" || module.prototypes[constant.protoId]?.numUpvalues !== 0) continue;
    const key = `${proto.id}:${insn.d}`;
    expected.set(key, (expected.get(key) ?? 0) + 1);
  }
  const resolvedKeys = new Set<string>();
  const body = rewriteBlocks(ast.body, body => {
    const groups = new Map<string, Load[]>();
    body.statements.forEach((statement, index) => {
      const fn = closureValue(statement);
      const identity = fn?.closureIdentity;
      if (!identity || identity.captureCount !== 0) return;
      const key = `${identity.ownerProtoId}:${identity.constantIndex}`;
      const group = groups.get(key) ?? [];
      group.push({index, statement, fn: fn!, key});
      groups.set(key, group);
    });
    const eligible = [...groups.entries()].filter(([key, sites]) =>
      sites.length > 1 && sites.length === expected.get(key));
    if (!eligible.length) return body;
    // Combining all groups in this block also handles interleaved slots. Each
    // slot still receives its own literal and its own native constant pool key.
    const loads = eligible.flatMap(([, sites]) => sites).sort((a, b) => a.index - b.index);
    if (loads.length > 64 || new Set(loads.map(load => load.fn.closureIdentity!.ownerProtoId)).size !== 1) return body;
    const first = loads[0]!.index, last = loads.at(-1)!.index;
    const interval = body.statements.slice(first, last + 1);
    if (interval.some(statement => escapingLoopControl(statement))) return body;
    const {bindings} = analyzeBindings(body);
    if (rewriteRegisterCount(bindings, body) + 4 > 180) return body;

    const segments = new Map<object, number>();
    body.statements.forEach((statement, index) => {
      let segment = -1;
      if (index > last) segment = loads.length;
      else for (let i = loads.length - 1; i >= 0; i--) if (index >= loads[i]!.index) { segment = i; break; }
      visitObjects(statement, node => segments.set(node, segment));
    });
    const owners = new Map<object, LexicalBinding>();
    for (const binding of bindings) for (const reference of [...binding.reads, ...binding.writes])
      owners.set(reference.node, binding);
    const hoisted = new Set<Statement>();
    const hoistedBindings = new Set<LexicalBinding>();
    for (const binding of bindings) {
      if (binding.scope !== body) continue;
      const declaration = binding.declaration as Statement;
      const index = body.statements.indexOf(declaration);
      if (index < first || index > last) continue;
      const segment = segments.get(declaration);
      if (![...binding.reads, ...binding.writes].some(reference => segments.get(reference.node) !== segment)) continue;
      if (declaration.kind !== "local" || declaration.values.some(value =>
        value.kind === "function-expr" && value.closureIdentity?.inlineCaptureInitializer)) return body;
      hoisted.add(declaration);
    }
    // One multi-result declaration is indivisible; all its names move together.
    for (const binding of bindings) if (hoisted.has(binding.declaration as Statement)) {
      if (binding.captured) return body;
      hoistedBindings.add(binding);
    }
    // Moving a declaration earlier must not capture a previously global or
    // differently shadowed read of the same spelling.
    let ambiguous = false;
    for (const binding of hoistedBindings) for (const statement of interval) visitObjects(statement, node => {
      const value = node as Expression;
      if (value.kind === "identifier" && value.name === binding.name && owners.get(node) !== binding) ambiguous = true;
    });
    if (ambiguous) return body;

    const stage = names.reserve("closureStage"), loaded = names.reserve("loadedClosure");
    const stageTest = (index: number): Expression => ({kind: "binary", op: "==", left: ident(stage), right: lit(index + 1)});
    const tests = (indices: number[]): Expression => indices.slice(1).reduce<Expression>((test, index) =>
      ({kind: "binary", op: "or", left: test, right: stageTest(index)}), stageTest(indices[0]!));
    const bySlot = eligible.map(([key]) => ({
      indices: loads.flatMap((load, index) => load.key === key ? [index] : []),
      fn: loads.find(load => load.key === key)!.fn,
    }));
    const store = (fn: FunctionExpression): Statement => {
      const declaration = namedClosureDeclaration(fn);
      return declaration ? {kind: "do", body: block([declaration,
        {kind: "assign", targets: [ident(loaded)], values: [ident(declaration.name)]}])}
        : {kind: "assign", targets: [ident(loaded)], values: [fn]};
    };
    const select: Statement = bySlot.length === 1 ? store(bySlot[0]!.fn) : {
      kind: "if", test: tests(bySlot[0]!.indices), consequent: block([store(bySlot[0]!.fn)]),
      branches: bySlot.slice(1, -1).map(slot => ({test: tests(slot.indices), body: block([store(slot.fn)])})),
      alternate: block([store(bySlot.at(-1)!.fn)]),
    };
    const segmentBodies = loads.map((load, index) => {
      const finish = index + 1 < loads.length ? loads[index + 1]!.index : last + 1;
      const statements: Statement[] = [];
      for (let i = load.index; i < finish; i++) {
        let statement = body.statements[i]!;
        if (i === load.index) {
          if (statement.kind === "local") statement = {...statement, values: [ident(loaded)]};
          else if (statement.kind === "assign") statement = {...statement, values: [ident(loaded)]};
        }
        if (hoisted.has(body.statements[i]!)) {
          if (statement.kind !== "local") return [];
          if (!statement.values.length) continue;
          statement = {kind: "assign", targets: statement.names.map(ident), values: statement.values};
        }
        statements.push(statement);
      }
      statements.push(index + 1 === loads.length ? {kind: "break"} :
        {kind: "assign", targets: [ident(stage)], values: [lit(index + 2)]});
      return statements;
    });
    const dispatch: Statement = {
      kind: "if", test: stageTest(0), consequent: block(segmentBodies[0]!),
      branches: segmentBodies.slice(1, -1).map((statements, index) =>
        ({test: stageTest(index + 1), body: block(statements)})),
      alternate: block(segmentBodies.at(-1)!),
    };
    const declarations: Statement[] = [...hoisted].map(statement => ({...(statement as Extract<Statement, {kind: "local"}>), values: []}));
    const replacement: Statement[] = [...declarations, {kind: "local", names: [stage], values: [lit(1)]},
      {kind: "while", test: lit(true), body: block([
        {kind: "local", names: [loaded], values: []}, select, dispatch,
      ])}];
    eligible.forEach(([key]) => resolvedKeys.add(key));
    return {...body, statements: [...body.statements.slice(0, first), ...replacement, ...body.statements.slice(last + 1)]};
  });
  return {ast: {...ast, body}, resolvedKeys};
}

function closureValue(statement: Statement): FunctionExpression | undefined {
  if (statement.kind === "local" && statement.names.length === 1 && statement.values.length === 1)
    return statement.values[0]?.kind === "function-expr" ? statement.values[0] : undefined;
  if (statement.kind === "assign" && statement.targets.length === 1 && statement.targets[0]?.kind === "identifier" && statement.values.length === 1)
    return statement.values[0]?.kind === "function-expr" ? statement.values[0] : undefined;
  return undefined;
}

function escapingLoopControl(statement: Statement, depth = 0): boolean {
  if (statement.kind === "break" || statement.kind === "continue") return depth === 0;
  if (statement.kind === "function-decl") return false;
  if (statement.kind === "if") return [statement.consequent, ...statement.branches.map(branch => branch.body), statement.alternate]
    .some(body => body?.statements.some(child => escapingLoopControl(child, depth)));
  if (statement.kind === "do") return statement.body.statements.some(child => escapingLoopControl(child, depth));
  if (statement.kind === "while" || statement.kind === "repeat" || statement.kind === "numeric-for" || statement.kind === "generic-for")
    return statement.body.statements.some(child => escapingLoopControl(child, depth + 1));
  return false;
}

function visitObjects(value: unknown, visit: (node: object) => void): void {
  if (!value || typeof value !== "object") return;
  visit(value);
  for (const child of Object.values(value)) if (Array.isArray(child)) child.forEach(value => visitObjects(value, visit));
  else visitObjects(child, visit);
}
