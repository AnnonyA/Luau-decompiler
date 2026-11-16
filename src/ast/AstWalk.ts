import type { Block, Expression, Statement } from "./Ast.js";

/** Rebuild an expression from its direct children. Function bodies are blocks,
 * not child expressions: they are reached through `mapFunctionBodies`. */
export function mapChildExpressions(expression: Expression, map: (child: Expression) => Expression): Expression {
  switch (expression.kind) {
    case "unary":
      return { ...expression, argument: map(expression.argument) };
    case "binary":
      return { ...expression, left: map(expression.left), right: map(expression.right) };
    case "call":
      return { ...expression, callee: map(expression.callee), args: expression.args.map(map) };
    case "method-call":
      return { ...expression, object: map(expression.object), args: expression.args.map(map) };
    case "index":
      return { ...expression, table: map(expression.table), key: map(expression.key) };
    case "property":
      return { ...expression, object: map(expression.object) };
    case "table":
      return {
        ...expression,
        fields: expression.fields.map((field) => ({
          ...field,
          ...(field.key ? { key: map(field.key) } : {}),
          value: map(field.value),
        })),
      };
    case "paren":
      return { ...expression, expression: map(expression.expression) };
    case "if-expr":
      return {
        ...expression,
        test: map(expression.test),
        consequent: map(expression.consequent),
        branches: expression.branches.map((branch) => ({ test: map(branch.test), value: map(branch.value) })),
        alternate: map(expression.alternate),
      };
    case "interp":
      return {
        ...expression,
        parts: expression.parts.map((part) =>
          part.kind === "expr" && typeof part.value !== "string" ? { kind: "expr" as const, value: map(part.value) } : part,
        ),
      };
    default:
      return expression;
  }
}

/** Bottom-up rewrite of an expression tree, stopping at function bodies. */
export function rewriteExpression(expression: Expression, rewrite: (node: Expression) => Expression): Expression {
  return rewrite(mapChildExpressions(expression, (child) => rewriteExpression(child, rewrite)));
}

export function forEachChildExpression(expression: Expression, visit: (child: Expression) => void): void {
  mapChildExpressions(expression, (child) => {
    visit(child);
    return child;
  });
}

/** Rebuild a statement from the expressions it evaluates itself. Nested
 * blocks (branches, loop bodies, function bodies) are left untouched. */
export function mapStatementExpressions(statement: Statement, map: (expression: Expression) => Expression): Statement {
  switch (statement.kind) {
    case "local":
      return { ...statement, values: statement.values.map(map) };
    case "assign":
      return { ...statement, targets: statement.targets.map(map), values: statement.values.map(map) };
    case "compound-assign":
      return { ...statement, target: map(statement.target), value: map(statement.value) };
    case "expression-stmt":
      return { ...statement, expression: map(statement.expression) };
    case "return":
      return { ...statement, values: statement.values.map(map) };
    case "if":
      return {
        ...statement,
        test: map(statement.test),
        branches: statement.branches.map((branch) => ({ ...branch, test: map(branch.test) })),
      };
    case "while":
      return { ...statement, test: map(statement.test) };
    case "repeat":
      return { ...statement, test: map(statement.test) };
    case "numeric-for":
      return {
        ...statement,
        start: map(statement.start),
        stop: map(statement.stop),
        ...(statement.step ? { step: map(statement.step) } : {}),
      };
    case "generic-for":
      return { ...statement, iterators: statement.iterators.map(map) };
    default:
      return statement;
  }
}

/** Rebuild a statement from its directly nested blocks. */
export function mapStatementBlocks(statement: Statement, map: (body: Block) => Block): Statement {
  switch (statement.kind) {
    case "function-decl":
    case "while":
    case "repeat":
    case "numeric-for":
    case "generic-for":
    case "do":
      return { ...statement, body: map(statement.body) };
    case "if":
      return {
        ...statement,
        consequent: map(statement.consequent),
        branches: statement.branches.map((branch) => ({ ...branch, body: map(branch.body) })),
        ...(statement.alternate ? { alternate: map(statement.alternate) } : {}),
      };
    default:
      return statement;
  }
}

/** Apply `map` to every block of the tree, innermost first. Function
 * expressions are entered wherever they appear inside a statement. */
export function rewriteBlocks(body: Block, map: (body: Block, isFunctionBody: boolean) => Block, isFunctionBody = true): Block {
  const intoExpression = (expression: Expression): Expression => {
    const mapped = mapChildExpressions(expression, intoExpression);
    return mapped.kind === "function-expr" ? { ...mapped, body: rewriteBlocks(mapped.body, map, true) } : mapped;
  };
  const statements = body.statements.map((statement) => {
    const withExpressions = mapStatementExpressions(statement, intoExpression);
    return mapStatementBlocks(withExpressions, (inner) => rewriteBlocks(inner, map, statement.kind === "function-decl"));
  });
  return map({ ...body, statements }, isFunctionBody);
}

/** Visit every identifier node below `node`, including nested functions.
 * A non-local `function a.b()` declaration reads its root name `a`. */
export function forEachIdentifier(node: Statement | Expression | Block, visit: (name: string) => void): void {
  const expression = (value: Expression): void => {
    if (value.kind === "identifier") {
      visit(value.name);
    } else if (value.kind === "function-expr") {
      block(value.body);
    } else {
      forEachChildExpression(value, expression);
    }
  };
  const statement = (value: Statement): void => {
    if (value.kind === "function-decl" && !value.local) visit(value.name.split(/[.:]/)[0]!);
    mapStatementExpressions(value, (child) => {
      expression(child);
      return child;
    });
    mapStatementBlocks(value, (inner) => {
      block(inner);
      return inner;
    });
  };
  const block = (value: Block): void => value.statements.forEach(statement);
  if (node.kind === "block") block(node);
  else if (isStatement(node)) statement(node);
  else expression(node);
}

const STATEMENT_KINDS = new Set([
  "local", "assign", "compound-assign", "function-decl", "if", "while", "repeat", "numeric-for",
  "generic-for", "return", "break", "continue", "expression-stmt", "do",
]);

export function isStatement(node: Statement | Expression | Block): node is Statement {
  return STATEMENT_KINDS.has(node.kind);
}

export function countIdentifier(node: Statement | Expression | Block, name: string): number {
  let count = 0;
  forEachIdentifier(node, (candidate) => {
    if (candidate === name) count += 1;
  });
  return count;
}

/** Names introduced anywhere below `body`: locals, parameters, loop variables. */
export function forEachDeclaredName(body: Block, visit: (name: string) => void): void {
  const expression = (value: Expression): void => {
    if (value.kind === "function-expr") {
      value.params.forEach(visit);
      block(value.body);
    } else {
      forEachChildExpression(value, expression);
    }
  };
  const block = (value: Block): void => {
    for (const statement of value.statements) {
      if (statement.kind === "local") statement.names.forEach(visit);
      if (statement.kind === "function-decl") {
        if (statement.local) visit(statement.name);
        statement.params.forEach(visit);
      }
      if (statement.kind === "numeric-for") visit(statement.name);
      if (statement.kind === "generic-for") statement.names.forEach(visit);
      mapStatementExpressions(statement, (child) => {
        expression(child);
        return child;
      });
      mapStatementBlocks(statement, (inner) => {
        block(inner);
        return inner;
      });
    }
  };
  block(body);
}

export function endsInExit(body: Block): boolean {
  const last = body.statements.at(-1);
  return last?.kind === "return" || last?.kind === "break" || last?.kind === "continue";
}
