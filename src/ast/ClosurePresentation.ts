import type { Chunk, Expression, FunctionExpression, Statement } from "./Ast.js";
import {
  countIdentifier,
  forEachDeclaredName,
  forEachIdentifier,
  mapChildExpressions,
  mapStatementExpressions,
  rewriteBlocks,
} from "./AstWalk.js";

/**
 * Give closures the source form their prototype proves.
 *
 * Luau records a debug name for `local function f`, `function t.f()` and
 * `{ f = function() end }`, and none for a function expression. A prototype
 * without a name was therefore written as an expression: when its value has
 * exactly one reader it returns to that position instead of a hoisted local.
 *
 * Runs on the reconstructor's raw tree, where every generated binding has a
 * module-unique name; a binding declared more than once is left alone.
 */
export function presentClosures(ast: Chunk): Chunk {
  const declarations = new Map<string, number>();
  forEachDeclaredName(ast.body, (name) => declarations.set(name, (declarations.get(name) ?? 0) + 1));
  const references = new Map<string, number>();
  forEachIdentifier(ast.body, (name) => references.set(name, (references.get(name) ?? 0) + 1));
  const unique = (name: string): boolean => declarations.get(name) === 1;

  const body = rewriteBlocks(ast.body, (block) => {
    const merged = mergeForwardDeclarations(block.statements, unique, references);
    return { ...block, statements: inlineSingleUse(merged, unique, references) };
  });
  return { ...ast, body };
}

/** `local f` directly followed by `f = function ... end` is one declaration. */
function mergeForwardDeclarations(
  statements: Statement[],
  unique: (name: string) => boolean,
  references: Map<string, number>,
): Statement[] {
  const out: Statement[] = [];
  for (let index = 0; index < statements.length; index++) {
    const declaration = statements[index]!;
    const assignment = statements[index + 1];
    if (
      declaration.kind === "local" && declaration.names.length === 1 && declaration.values.length === 0 &&
      assignment?.kind === "assign" && assignment.targets.length === 1 && assignment.values.length === 1
    ) {
      const name = declaration.names[0]!;
      const target = assignment.targets[0]!;
      const fn = assignment.values[0]!;
      if (unique(name) && target.kind === "identifier" && target.name === name && fn.kind === "function-expr") {
        if (fn.debugName === name) {
          // `local function f` is defined as exactly this pair of statements.
          out.push({
            kind: "function-decl", local: true, name, params: fn.params, paramTypes: fn.paramTypes,
            returnType: fn.returnType, isVararg: fn.isVararg, body: fn.body, line: fn.line,
          });
          index += 1;
          continue;
        }
        if (countIdentifier(fn.body, name) === 0) {
          // The assignment target is no longer a reference of its own.
          references.set(name, (references.get(name) ?? 1) - 1);
          out.push({ ...declaration, values: [fn] });
          index += 1;
          continue;
        }
      }
    }
    out.push(declaration);
  }
  return out;
}

function inlineSingleUse(
  statements: Statement[],
  unique: (name: string) => boolean,
  references: Map<string, number>,
): Statement[] {
  const out = [...statements];
  for (let index = out.length - 1; index >= 0; index--) {
    const declaration = out[index]!;
    if (declaration.kind !== "local" || declaration.names.length !== 1 || declaration.values.length !== 1) continue;
    const name = declaration.names[0]!;
    const fn = declaration.values[0]!;
    if (fn.kind !== "function-expr" || fn.debugName !== undefined) continue;
    if (!unique(name) || references.get(name) !== 1) continue;
    for (let next = index + 1; next < out.length; next++) {
      const consumer = out[next]!;
      if (countIdentifier(consumer, name) === 0) continue;
      const replaced = substituteOnce(consumer, name, fn);
      if (replaced) {
        out[next] = replaced;
        out.splice(index, 1);
      }
      break;
    }
  }
  return out;
}

/** Replace the one read of `name` among the expressions this statement
 * evaluates once, itself. A loop test or a nested block may run repeatedly
 * and would create a new closure each time. */
function substituteOnce(statement: Statement, name: string, fn: FunctionExpression): Statement | undefined {
  if (statement.kind === "while" || statement.kind === "repeat" || statement.kind === "function-decl" ||
      statement.kind === "do") return undefined;
  if (statement.kind === "assign" &&
      statement.targets.some((target) => target.kind === "identifier" && target.name === name)) return undefined;
  if (statement.kind === "compound-assign" && statement.target.kind === "identifier" &&
      statement.target.name === name) return undefined;
  let hits = 0;
  const callee = (expression: Expression): Expression =>
    expression.kind === "function-expr" ? { kind: "paren", expression } : expression;
  const replace = (expression: Expression): Expression => {
    if (expression.kind === "identifier") {
      if (expression.name !== name) return expression;
      hits += 1;
      return fn;
    }
    const mapped = mapChildExpressions(expression, replace);
    // A function literal is not a prefix expression: `(function() end)()`.
    switch (mapped.kind) {
      case "call": return { ...mapped, callee: callee(mapped.callee) };
      case "method-call": return { ...mapped, object: callee(mapped.object) };
      case "property": return { ...mapped, object: callee(mapped.object) };
      case "index": return { ...mapped, table: callee(mapped.table) };
      default: return mapped;
    }
  };
  let result: Statement;
  if (statement.kind === "if") {
    // Only the first test is evaluated unconditionally before any branch.
    result = { ...statement, test: replace(statement.test) };
  } else if (statement.kind === "assign") {
    result = { ...statement, values: statement.values.map(replace) };
  } else if (statement.kind === "compound-assign") {
    result = { ...statement, value: replace(statement.value) };
  } else {
    result = mapStatementExpressions(statement, replace);
  }
  return hits === 1 ? result : undefined;
}
