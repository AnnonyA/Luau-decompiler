import { analyzeBindings, type LexicalBinding } from "../analysis/Bindings.js";
import type { Block, CallExpression, Expression } from "../ast/Ast.js";

export interface CallBoundaryPresentation {
  grouped: ReadonlySet<CallExpression>;
  direct: ReadonlySet<CallExpression>;
}

/** Calls whose final source cannot reveal an inlineable literal to Luau.
 *
 * Compiler.cpp::getFunctionExpr follows immutable local initializers, groups
 * and fields of a local table constructor. It never resolves an unknown
 * runtime value into an AST function. For these calls a grouping alone keeps
 * Builtins.cpp::getBuiltin from adding a new builtin optimization. Calls that
 * might reveal a literal retain the stronger constant-boolean boundary.
 *
 * This is a printer-only decision on the final lexical scopes. It neither
 * removes the bytecode boundary metadata nor assumes the callee is pure.
 */
export function analyzeCallBoundaries(body: Block): CallBoundaryPresentation {
  const calls: CallExpression[] = [];
  const pending: unknown[] = [body];
  while (pending.length) {
    const value = pending.pop();
    if (!value || typeof value !== "object") continue;
    const node = value as {kind?: string};
    if (node.kind === "call") {
      const call = value as CallExpression;
      if (call.preserveBoundary && !call.inlineForIdentity) calls.push(call);
    }
    pending.push(...Object.values(value));
  }
  const grouped = new Set<CallExpression>();
  if (!calls.length) return {grouped, direct: new Set()};

  const references = new Map<Expression, LexicalBinding | null>();
  const {bindings} = analyzeBindings(body);
  for (const binding of bindings) {
    for (const {node} of binding.reads) {
      // Reused AST nodes must not turn two lexical bindings into one proof.
      if (references.has(node) && references.get(node) !== binding) references.set(node, null);
      else references.set(node, binding);
    }
  }
  const ungroup = (expression: Expression): Expression => {
    while (expression.kind === "paren") expression = expression.expression;
    return expression;
  };
  const initializer = (binding: LexicalBinding): Expression | undefined =>
    binding.declaration.kind === "local" && binding.writes.length === 0
      ? binding.declaration.values[binding.declarationIndex ?? -1] : undefined;

  const canRevealLiteral = (expression: Expression, seen: Set<LexicalBinding>): boolean => {
    expression = ungroup(expression);
    switch (expression.kind) {
      case "function-expr": return !expression.isVararg;
      case "identifier": {
        const binding = references.get(expression);
        if (binding === null) return true;
        if (!binding || binding.writes.length) return false;
        if (seen.has(binding) || seen.size >= 128) return true;
        const declaration = binding.declaration;
        if (declaration.kind === "function-decl") {
          // Parameter bindings point at the same function declaration, but
          // only the outer local binding has its literal as an initializer.
          return declaration.local && binding.scope !== declaration.body && !declaration.isVararg;
        }
        const value = initializer(binding);
        return !!value && canRevealLiteral(value, new Set(seen).add(binding));
      }
      case "property": {
        const object = ungroup(expression.object);
        if (object.kind !== "identifier") return false;
        const binding = references.get(object);
        if (binding === null) return true;
        if (!binding) return false;
        const value = initializer(binding);
        // Deliberately keep every local table literal, without relying on
        // field uniqueness, escape analysis, key folding or write tracking.
        return value !== undefined && ungroup(value).kind === "table";
      }
      default: return false;
    }
  };
  for (const call of calls) {
    if (!canRevealLiteral(call.callee, new Set())) grouped.add(call);
  }
  // A known literal vararg function cannot be inlined by either pinned Luau
  // compiler. getBuiltin cannot reinterpret a function literal either, so an
  // immutable local/alias to it needs no extra group, regardless of body effects.
  const variadicLiteral = (expression: Expression, seen: Set<LexicalBinding>): boolean => {
    expression = ungroup(expression);
    if (expression.kind === "function-expr") return expression.isVararg;
    if (expression.kind !== "identifier") return false;
    const binding = references.get(expression);
    if (!binding || binding.writes.length || seen.has(binding) || seen.size >= 32) return false;
    const declaration = binding.declaration;
    if (declaration.kind === "function-decl")
      return declaration.local && binding.scope !== declaration.body && declaration.isVararg;
    const value = initializer(binding);
    return !!value && variadicLiteral(value, new Set(seen).add(binding));
  };
  const direct = new Set(calls.filter(call => ungroup(call.callee).kind === "identifier" && variadicLiteral(call.callee, new Set())));
  return {grouped, direct};
}

export function groupedCallBoundaries(body: Block): ReadonlySet<CallExpression> {
  return analyzeCallBoundaries(body).grouped;
}
