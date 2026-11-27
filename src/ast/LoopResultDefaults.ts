import {analyzeBindings, type LexicalBinding} from "../analysis/Bindings.js";
import type {Block, Chunk, Expression, Statement} from "./Ast.js";
import {mapChildExpressions, mapStatementBlocks, mapStatementExpressions} from "./AstWalk.js";

type Loop = Extract<Statement, {kind: "while" | "repeat" | "numeric-for" | "generic-for"}>;
const isLoop = (statement: Statement | undefined): statement is Loop => statement !== undefined &&
  ["while", "repeat", "numeric-for", "generic-for"].includes(statement.kind);
const boolean = (expression: Expression | undefined, value: boolean): boolean =>
  expression?.kind === "literal" && expression.value === value;

/** Positive primitive-result proof, not an effect or purity classification.
 * Comparisons may call metamethods; their location and evaluation never move.
 * Arithmetic is excluded because a metamethod may return an object.
 */
function primitive(expression: Expression | undefined): boolean {
  if (!expression) return false;
  switch (expression.kind) {
    case "literal": return true;
    case "paren": return primitive(expression.expression);
    case "unary": return expression.op === "not";
    case "binary":
      return ["==", "~=", "<", "<=", ">", ">="].includes(expression.op) ||
        ((expression.op === "and" || expression.op === "or") && primitive(expression.left) && primitive(expression.right));
    case "if-expr":
      return primitive(expression.consequent) && primitive(expression.alternate) &&
        expression.branches.every(branch => primitive(branch.value));
    default: return false;
  }
}

function onlyPrimitiveValues(binding: LexicalBinding): boolean {
  const declaration = binding.declaration;
  if (declaration.kind !== "local") return false;
  const index = binding.declarationIndex ?? -1;
  // Do not infer nil padding after an open call or vararg initializer.
  if (declaration.values.length && !primitive(declaration.values[index])) return false;
  return binding.writes.every(reference => reference.statement.kind === "assign" &&
    reference.statement.targets.length === 1 && reference.statement.targets[0] === reference.node &&
    reference.statement.values.length === 1 && primitive(reference.statement.values[0]));
}

/** Remove an introduced normal-exit flag when the tail only supplies a private
 * primitive result's literal default. Successful stores and current-loop
 * breaks stay where they were, including any comparison effects.
 *
 * No captured or loop-read binding qualifies. Checking every result writer is
 * necessary: overwriting an otherwise unread table earlier could shorten its
 * lifetime and become observable through weak tables or garbage collection.
 */
export function recoverLoopResultDefaults(ast: Chunk): Chunk {
  const {bindings} = analyzeBindings(ast.body);
  const references = new Map<Expression, LexicalBinding | null>();
  const declarations = new Map<Statement, LexicalBinding>();
  for (const binding of bindings) {
    if (binding.declaration.kind === "local" && binding.declaration.names.length === 1)
      declarations.set(binding.declaration, binding);
    for (const reference of [...binding.reads, ...binding.writes]) {
      if (references.has(reference.node) && references.get(reference.node) !== binding) references.set(reference.node, null);
      else references.set(reference.node, binding);
    }
  }
  const replacements = new Map<Statement, Statement[]>();
  const nodesBelow = (root: unknown): Set<object> => {
    const found = new Set<object>(), pending = [root];
    while (pending.length) {
      const value = pending.pop();
      if (!value || typeof value !== "object" || found.has(value)) continue;
      found.add(value);
      pending.push(...Object.values(value));
    }
    return found;
  };
  const writeTo = (statement: Statement | undefined, binding: LexicalBinding): boolean =>
    statement?.kind === "assign" && statement.targets.length === 1 &&
    statement.values.length === 1 && references.get(statement.targets[0]!) === binding;

  for (const node of nodesBelow(ast.body)) {
    const body = node as Block;
    if (body.kind !== "block") continue;
    const statements = body.statements;
    for (let index = 0; index < statements.length; index++) {
      const declaration = statements[index]!;
      if (declaration.kind !== "local" || !declaration.syntheticLoopTail || declaration.names.length !== 1 ||
          declaration.values.length !== 1 || !boolean(declaration.values[0], true)) continue;
      const flag = declarations.get(declaration);
      if (!flag || flag.captured || flag.reads.length !== 1 || flag.writes.length === 0) continue;
      let loopIndex = index + 1;
      // A result phi may be declared between the flag and loop. Keep those
      // declarations in scope and insert the default after them.
      while (statements[loopIndex]?.kind === "local" &&
          (statements[loopIndex] as Extract<Statement, {kind: "local"}>).values.length === 0) loopIndex++;
      const loop = statements[loopIndex], guard = statements[loopIndex + 1];
      if (!isLoop(loop) || guard?.kind !== "if" || guard.branches.length || guard.alternate ||
          guard.test !== flag.reads[0]!.node || references.get(guard.test) !== flag ||
          guard.consequent.statements.length !== 1) continue;
      const fallback = guard.consequent.statements[0]!;
      if (fallback.kind !== "assign" || fallback.targets.length !== 1 || fallback.targets[0]!.kind !== "identifier" ||
          fallback.values.length !== 1 || fallback.values[0]!.kind !== "literal") continue;
      const result = references.get(fallback.targets[0]!);
      if (!result || result === flag || result.captured || !onlyPrimitiveValues(result)) continue;
      const within = nodesBelow(loop);
      if (result.reads.some(reference => within.has(reference.node))) continue;

      const flagStores = new Set<Statement>(), resultStores = new Set<Statement>();
      const scanExits = (region: Block): void => {
        for (let i = 0; i < region.statements.length; i++) {
          const statement = region.statements[i]!;
          if (writeTo(statement, flag) && statement.kind === "assign" && boolean(statement.values[0], false) &&
              region.statements[i + 1]?.kind === "break" && writeTo(region.statements[i - 1], result)) {
            flagStores.add(statement);
            resultStores.add(region.statements[i - 1]!);
          }
          // Nested-loop breaks belong to that loop. Function bodies likewise
          // never participate in this loop's exit proof.
          if (statement.kind === "do") scanExits(statement.body);
          if (statement.kind === "if") {
            scanExits(statement.consequent);
            statement.branches.forEach(branch => scanExits(branch.body));
            if (statement.alternate) scanExits(statement.alternate);
          }
        }
      };
      scanExits(loop.body);
      if (!flagStores.size || flag.writes.some(reference => !flagStores.has(reference.statement)) ||
          result.writes.some(reference => within.has(reference.node) && !resultStores.has(reference.statement))) continue;
      replacements.set(declaration, []);
      replacements.set(loop, [fallback, loop]);
      replacements.set(guard, []);
      for (const store of flagStores) replacements.set(store, []);
    }
  }
  if (!replacements.size) return ast;
  // Plans use original identities so nested successful rewrites cannot
  // invalidate an enclosing loop's plan or an identifier's lexical proof.
  const rewriteExpression = (value: Expression): Expression => {
    const mapped = mapChildExpressions(value, rewriteExpression);
    return mapped.kind === "function-expr" ? {...mapped, body: rewriteBlock(mapped.body)} : mapped;
  };
  const rewriteBlock = (body: Block): Block => ({...body, statements: body.statements
    .flatMap(statement => replacements.get(statement) ?? [statement])
    .map(statement => mapStatementBlocks(mapStatementExpressions(statement, rewriteExpression), rewriteBlock))});
  return {...ast, body: rewriteBlock(ast.body)};
}
