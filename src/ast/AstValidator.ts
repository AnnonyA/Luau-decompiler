import type { Block, Chunk, Expression, Statement } from "./Ast.js";

export interface ValidationFailure {
  code: string;
  message: string;
}

const KEYWORDS = new Set([
  "and",
  "break",
  "do",
  "else",
  "elseif",
  "end",
  "false",
  "for",
  "function",
  "if",
  "in",
  "local",
  "nil",
  "not",
  "or",
  "repeat",
  "return",
  "then",
  "true",
  "until",
  "while",
  "continue",
]);

export function validateAst(ast: Chunk): ValidationFailure[] {
  const failures: ValidationFailure[] = [];
  const scopes: string[][] = [[]];
  visitBlock(ast.body, scopes, 0, failures);
  return failures;
}

function visitBlock(body: Block, scopes: string[][], loopDepth: number, failures: ValidationFailure[]): void {
  scopes.push([]);
  for (const statement of body.statements) {
    visitStatement(statement, scopes, loopDepth, failures);
  }
  scopes.pop();
}

function visitStatement(statement: Statement, scopes: string[][], loopDepth: number, failures: ValidationFailure[]): void {
  switch (statement.kind) {
    case "local":
      for (const value of statement.values) {
        visitExpr(value, scopes, failures);
      }
      for (const name of statement.names) {
        declare(name, scopes, failures);
      }
      break;
    case "assign":
      for (const target of statement.targets) {
        visitExpr(target, scopes, failures);
      }
      for (const value of statement.values) {
        visitExpr(value, scopes, failures);
      }
      break;
    case "compound-assign":
      visitExpr(statement.target, scopes, failures);
      visitExpr(statement.value, scopes, failures);
      break;
    case "function-decl":
      if (statement.local) {
        declare(statement.name, scopes, failures);
      }
      scopes.push([]);
      for (const param of statement.params) {
        declare(param, scopes, failures);
      }
      visitBlock(statement.body, scopes, 0, failures);
      scopes.pop();
      break;
    case "if":
      visitExpr(statement.test, scopes, failures);
      visitBlock(statement.consequent, scopes, loopDepth, failures);
      for (const branch of statement.branches) {
        visitExpr(branch.test, scopes, failures);
        visitBlock(branch.body, scopes, loopDepth, failures);
      }
      if (statement.alternate) {
        visitBlock(statement.alternate, scopes, loopDepth, failures);
      }
      break;
    case "while":
      visitExpr(statement.test, scopes, failures);
      visitBlock(statement.body, scopes, loopDepth + 1, failures);
      break;
    case "repeat":
      visitBlock(statement.body, scopes, loopDepth + 1, failures);
      visitExpr(statement.test, scopes, failures);
      break;
    case "numeric-for":
      visitExpr(statement.start, scopes, failures);
      visitExpr(statement.stop, scopes, failures);
      if (statement.step) {
        visitExpr(statement.step, scopes, failures);
      }
      scopes.push([]);
      declare(statement.name, scopes, failures);
      visitBlock(statement.body, scopes, loopDepth + 1, failures);
      scopes.pop();
      break;
    case "generic-for":
      for (const iterator of statement.iterators) {
        visitExpr(iterator, scopes, failures);
      }
      scopes.push([]);
      for (const name of statement.names) {
        declare(name, scopes, failures);
      }
      visitBlock(statement.body, scopes, loopDepth + 1, failures);
      scopes.pop();
      break;
    case "return":
      for (const value of statement.values) {
        visitExpr(value, scopes, failures);
      }
      break;
    case "break":
    case "continue":
      if (loopDepth <= 0) {
        failures.push({ code: "loop-escape", message: `${statement.kind} is not nested in a loop` });
      }
      break;
    case "expression-stmt":
      visitExpr(statement.expression, scopes, failures);
      break;
    case "do":
      visitBlock(statement.body, scopes, loopDepth, failures);
      break;
  }
}

function visitExpr(expression: Expression, scopes: string[][], failures: ValidationFailure[]): void {
  switch (expression.kind) {
    case "identifier":
      if (!isValidName(expression.name)) {
        failures.push({ code: "identifier", message: `invalid identifier ${expression.name}` });
      }
      break;
    case "literal":
    case "vararg":
      break;
    case "unary":
      visitExpr(expression.argument, scopes, failures);
      break;
    case "binary":
      visitExpr(expression.left, scopes, failures);
      visitExpr(expression.right, scopes, failures);
      break;
    case "call":
      visitExpr(expression.callee, scopes, failures);
      for (const arg of expression.args) {
        visitExpr(arg, scopes, failures);
      }
      break;
    case "method-call":
      visitExpr(expression.object, scopes, failures);
      for (const arg of expression.args) {
        visitExpr(arg, scopes, failures);
      }
      break;
    case "index":
      visitExpr(expression.table, scopes, failures);
      visitExpr(expression.key, scopes, failures);
      break;
    case "property":
      visitExpr(expression.object, scopes, failures);
      if (!isValidName(expression.name)) {
        failures.push({ code: "identifier", message: `invalid property ${expression.name}` });
      }
      break;
    case "table":
      for (const field of expression.fields) {
        if (field.key) {
          visitExpr(field.key, scopes, failures);
        }
        visitExpr(field.value, scopes, failures);
      }
      break;
    case "function-expr":
      scopes.push([]);
      for (const param of expression.params) {
        declare(param, scopes, failures);
      }
      visitBlock(expression.body, scopes, 0, failures);
      scopes.pop();
      break;
    case "paren":
      visitExpr(expression.expression, scopes, failures);
      break;
    case "if-expr":
      visitExpr(expression.test, scopes, failures);
      visitExpr(expression.consequent, scopes, failures);
      visitExpr(expression.alternate, scopes, failures);
      break;
    case "interp":
      for (const part of expression.parts) {
        if (part.kind === "expr" && typeof part.value !== "string") {
          visitExpr(part.value, scopes, failures);
        }
      }
      break;
  }
}

function declare(name: string, scopes: string[][], failures: ValidationFailure[]): void {
  if (!isValidName(name)) {
    failures.push({ code: "identifier", message: `invalid binding ${name}` });
    return;
  }
  scopes[scopes.length - 1]?.push(name);
}

function isValidName(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) && !KEYWORDS.has(name);
}
