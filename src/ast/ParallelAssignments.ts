import { analyzeBindings, type LexicalBinding } from "../analysis/Bindings.js";
import type { Assignment, Chunk, Expression, LocalDeclaration, Statement } from "./Ast.js";
import { rewriteBlocks } from "./AstWalk.js";

/** Restore a fixed parallel store from private, already evaluated scalar
 * results. This exposes its target/RHS evaluation order to temporary folding.
 *
 * Luau evaluates every indexed destination before the RHS, then writes those
 * destinations from left to right. Only inert destination operands may move
 * ahead of a preceding store. Local/global assignment targets are excluded:
 * the compiler may write a nonconflicting local while evaluating the RHS.
 */
export function recoverParallelAssignments(ast: Chunk): Chunk {
  const { bindings } = analyzeBindings(ast.body);
  const byRead = new Map<Expression, LexicalBinding | null>();
  for (const binding of bindings) for (const read of binding.reads) {
    // A shared expression node can appear in distinct lexical scopes. Its
    // final visitor must not supply an unrelated binding's mutability proof.
    if (byRead.has(read.node) && byRead.get(read.node) !== binding) byRead.set(read.node, null);
    else byRead.set(read.node, binding);
  }

  const inert = (value: Expression): boolean => {
    if (value.kind === "literal") return true;
    if (value.kind !== "identifier") return false;
    const binding = byRead.get(value);
    // An indexed write can call __newindex. An uncaptured cell cannot change
    // in that callback, and an immutable captured cell cannot change at all.
    return Boolean(binding && (!binding.captured || binding.writes.length === 0));
  };
  const destination = (value: Expression): boolean => value.kind === "property" ? inert(value.object)
    : value.kind === "index" && inert(value.table) && inert(value.key);
  const result = (statement: Statement): LocalDeclaration | undefined => {
    if (statement.kind !== "assign" || statement.targets.length !== 1 || statement.values.length !== 1 ||
        !destination(statement.targets[0]!)) return undefined;
    const value = statement.values[0]!;
    const binding = byRead.get(value);
    if (!binding || binding.captured || binding.writes.length || binding.reads.length !== 1 ||
        binding.declaration.kind !== "local") return undefined;
    const declaration = binding.declaration;
    // No textual-name heuristic or unknown AST ownership is sufficient to
    // classify a source local as this bytecode's fixed scalar scratch slot.
    return declaration.names.length === 1 && declaration.values.length === 1 &&
      declaration.definition && declaration.definition.debugName === undefined &&
      !declaration.debugDeclaration ? declaration : undefined;
  };

  const body = rewriteBlocks(ast.body, block => {
    const positions = new Map(block.statements.map((statement, index) => [statement, index]));
    const statements: Statement[] = [];
    let changed = false;
    for (let index = 0; index < block.statements.length;) {
      const first = block.statements[index]!;
      const firstResult = result(first);
      const firstPosition = firstResult && positions.get(firstResult);
      if (!firstResult || firstPosition === undefined || firstPosition >= index) {
        statements.push(first); index++; continue;
      }
      const group: Assignment[] = [first as Assignment];
      const definitions: LocalDeclaration[] = [firstResult];
      let next = index + 1;
      // A small bound avoids creating a large simultaneous register pack.
      for (; next < block.statements.length && group.length < 8; next++) {
        const candidate = block.statements[next]!;
        const declaration = result(candidate);
        const position = declaration && positions.get(declaration);
        if (!declaration || position === undefined || position >= index ||
            declaration.definition!.prototypeId !== firstResult.definition!.prototypeId) break;
        group.push(candidate as Assignment);
        definitions.push(declaration);
      }
      // Demand one contiguous scalar-result run immediately before the
      // stores, in the same order. We do not merge arbitrary later writes.
      const start = index - definitions.length;
      const adjacent = definitions.every((declaration, offset) => positions.get(declaration) === start + offset);
      if (group.length > 1 && adjacent) {
        statements.push({kind: "assign", targets: group.map(item => item.targets[0]!),
          values: group.map(item => item.values[0]!)});
        index = next;
        changed = true;
      } else {
        statements.push(first); index++;
      }
    }
    return changed ? {...block, statements} : block;
  });
  return body === ast.body ? ast : {...ast, body};
}
