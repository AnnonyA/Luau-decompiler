import { block } from "./Ast.js";
import type { BinaryOperator, Block, Chunk, Expression, FunctionExpression, Statement } from "./Ast.js";
import { callbackParamsFor, MATH_CONSTANTS, typeFromExpression } from "../reconstruct/RobloxSemantics.js";
import { isValidIdentifier } from "../reconstruct/Naming.js";

export interface CleanupOptions {
  typeAnnotations: "off" | "functions" | "useful";
  ifExpressions: boolean;
  earlyReturn: boolean;
  interpolatedStrings: boolean;
  mathConstants: boolean;
}

export function cleanupAst(ast: Chunk, options: CleanupOptions): Chunk {
  const body = transformBlock(ast.body, options);
  return { kind: "chunk", body };
}

function transformBlock(body: Block, options: CleanupOptions): Block {
  let statements = flattenElseIf(body.statements).map((statement) => transformStatement(statement, options));
  statements = invertContinueIfs(statements);
  const withIfExpr = options.ifExpressions ? recoverIfExpressions(statements) : statements;
  const withReturns = options.earlyReturn ? recoverEarlyReturns(withIfExpr) : withIfExpr;
  const withoutDead = removeUnusedLocals(withReturns);
  const withLocalFunctions = liftLocalFunctions(withoutDead);
  return { kind: "block", statements: withLocalFunctions };
}

/** `local name = function(...) body end` becomes `local function name(...)` when
 * the closure is not immediately assigned to a table field afterwards. */
function liftLocalFunctions(statements: Statement[]): Statement[] {
  const liftedNames = new Set<string>();
  for (const statement of statements) {
    if (statement.kind === "function-decl") {
      liftedNames.add(statement.name.slice(statement.name.lastIndexOf(":") + 1));
    }
  }
  return statements.map((statement) => {
    if (
      statement.kind !== "local" ||
      statement.names.length !== 1 ||
      statement.values.length !== 1 ||
      liftedNames.has(statement.names[0]!)
    ) {
      return statement;
    }
    const value = statement.values[0];
    if (!value || value.kind !== "function-expr") {
      return statement;
    }
    return {
      kind: "function-decl",
      local: true,
      name: statement.names[0]!,
      params: value.params,
      paramTypes: value.paramTypes,
      returnType: value.returnType,
      isVararg: value.isVararg,
      body: value.body,
    };
  });
}

/** `if not X then continue end; S...` at the start of a loop body becomes
 * `if X then S... end` (both keep short-circuit evaluation). */
function invertContinueIfs(statements: Statement[]): Statement[] {
  const out: Statement[] = [];
  let index = 0;
  while (index < statements.length) {
    const statement = statements[index]!;
    if (
      statement.kind === "if" &&
      statement.branches.length === 0 &&
      !statement.alternate &&
      statement.consequent.statements.length === 1 &&
      statement.consequent.statements[0]?.kind === "continue"
    ) {
      const test = negateCondition(statement.test);
      if (test) {
        const rest = statements.slice(index + 1);
        if (rest.length > 0) {
          out.push({ kind: "if", test, consequent: block(rest), branches: [] });
          return out;
        }
      }
    }
    out.push(statement);
    index += 1;
  }
  return out;
}

/** Drop `local x = <fn>` declarations whose name is never referenced again
 * (they are superseded by lifted method declarations). */
function removeUnusedLocals(statements: Statement[]): Statement[] {
  const referenced = new Set<string>();
  const liftedNames = new Set<string>();
  const locals: Array<{ name: string; statement: Statement }> = [];
  for (const statement of statements) {
    if (statement.kind === "local" && statement.names.length === 1 && statement.values.length === 1) {
      locals.push({ name: statement.names[0]!, statement });
    }
    if (statement.kind === "function-decl") {
      const tail = statement.name.slice(statement.name.lastIndexOf(":") + 1);
      liftedNames.add(tail);
    }
    collectIdentifiers(statement, (name) => {
      referenced.add(name);
    });
  }
  return statements.filter((statement) => {
    if (statement.kind !== "local" || statement.names.length !== 1) {
      return true;
    }
    const name = statement.names[0]!;
    const local = locals.find((candidate) => candidate.statement === statement);
    if (!local || referenced.has(name)) {
      return true;
    }
    const value = statement.values[0];
    if (!value || value.kind !== "function-expr") {
      return true;
    }
    // Only drop closure locals superseded by a lifted method declaration.
    return !liftedNames.has(name);
  });
}

function collectIdentifiers(statement: Statement, visit: (name: string) => void): void {
  const walkExpr = (expression: Expression): void => {
    switch (expression.kind) {
      case "identifier":
        visit(expression.name);
        break;
      case "unary":
        walkExpr(expression.argument);
        break;
      case "binary":
        walkExpr(expression.left);
        walkExpr(expression.right);
        break;
      case "call":
        walkExpr(expression.callee);
        expression.args.forEach(walkExpr);
        break;
      case "method-call":
        walkExpr(expression.object);
        expression.args.forEach(walkExpr);
        break;
      case "index":
        walkExpr(expression.table);
        walkExpr(expression.key);
        break;
      case "property":
        walkExpr(expression.object);
        break;
      case "table":
        expression.fields.forEach((field) => {
          if (field.key) {
            walkExpr(field.key);
          }
          walkExpr(field.value);
        });
        break;
      case "function-expr":
        expression.body.statements.forEach(walkStmt);
        break;
      case "paren":
        walkExpr(expression.expression);
        break;
      case "if-expr":
        walkExpr(expression.test);
        walkExpr(expression.consequent);
        expression.branches.forEach((branch) => {
          walkExpr(branch.test);
          walkExpr(branch.value);
        });
        walkExpr(expression.alternate);
        break;
      case "interp":
        expression.parts.forEach((part) => {
          if (part.kind === "expr" && typeof part.value !== "string") {
            walkExpr(part.value);
          }
        });
        break;
      default:
        break;
    }
  };
  const walkStmt = (item: Statement): void => {
    switch (item.kind) {
      case "local":
        item.values.forEach(walkExpr);
        break;
      case "assign":
        item.targets.forEach(walkExpr);
        item.values.forEach(walkExpr);
        break;
      case "function-decl":
        item.body.statements.forEach(walkStmt);
        break;
      case "if":
        walkExpr(item.test);
        item.consequent.statements.forEach(walkStmt);
        item.branches.forEach((branch) => {
          walkExpr(branch.test);
          branch.body.statements.forEach(walkStmt);
        });
        item.alternate?.statements.forEach(walkStmt);
        break;
      case "while":
        walkExpr(item.test);
        item.body.statements.forEach(walkStmt);
        break;
      case "repeat":
        item.body.statements.forEach(walkStmt);
        walkExpr(item.test);
        break;
      case "numeric-for":
        walkExpr(item.start);
        walkExpr(item.stop);
        if (item.step) {
          walkExpr(item.step);
        }
        item.body.statements.forEach(walkStmt);
        break;
      case "generic-for":
        item.iterators.forEach(walkExpr);
        item.body.statements.forEach(walkStmt);
        break;
      case "return":
        item.values.forEach(walkExpr);
        break;
      case "expression-stmt":
        walkExpr(item.expression);
        break;
      case "do":
        item.body.statements.forEach(walkStmt);
        break;
      default:
        break;
    }
  };
  walkStmt(statement);
}

/** `lit < x` becomes `x > lit`; `lit <= x` becomes `x >= lit`. */
function normalizeComparison(expression: Expression): Expression {
  if (expression.kind !== "binary") {
    return expression;
  }
  const { op, left, right } = expression;
  if (left.kind === "literal" && typeof left.value === "number") {
    if (op === "<") {
      return { kind: "binary", op: ">", left: right, right: left };
    }
    if (op === "<=") {
      return { kind: "binary", op: ">=", left: right, right: left };
    }
    if (op === ">") {
      return { kind: "binary", op: "<", left: right, right: left };
    }
    if (op === ">=") {
      return { kind: "binary", op: "<=", left: right, right: left };
    }
  }
  return expression;
}

/** Negate a condition, preferring a direct comparison operator. */
function negateCondition(expression: Expression): Expression | undefined {
  if (expression.kind === "unary" && expression.op === "not") {
    return expression.argument;
  }
  if (expression.kind === "binary") {
    const flipped: Record<string, string> = {
      "==": "~=",
      "~=": "==",
      "<": ">=",
      "<=": ">",
      ">": "<=",
      ">=": "<",
    };
    const next = flipped[expression.op];
    if (next) {
      return { kind: "binary", op: next as BinaryOperator, left: expression.left, right: expression.right };
    }
  }
  // A plain value can always be negated (`x` -> `not x`).
  if (expression.kind === "identifier" || expression.kind === "property" || expression.kind === "index") {
    return { kind: "unary", op: "not", argument: expression };
  }
  return undefined;
}

function transformStatement(statement: Statement, options: CleanupOptions): Statement {
  switch (statement.kind) {
    case "local":
      return {
        ...statement,
        values: statement.values.map((value) => transformExpr(value, options)),
        types: annotateLocals(statement, options),
      };
    case "assign":
      return {
        ...statement,
        targets: statement.targets.map((target) => transformExpr(target, options)),
        values: statement.values.map((value) => transformExpr(value, options)),
      };
    case "function-decl":
      return {
        ...statement,
        body: transformBlock(statement.body, options),
        paramTypes: options.typeAnnotations === "off" ? undefined : statement.paramTypes,
        returnType: options.typeAnnotations === "off" ? undefined : statement.returnType,
      };
    case "if":
      return {
        ...statement,
        test: transformExpr(statement.test, options),
        consequent: transformBlock(statement.consequent, options),
        branches: statement.branches.map((branch) => ({
          test: transformExpr(branch.test, options),
          body: transformBlock(branch.body, options),
        })),
        alternate: statement.alternate ? transformBlock(statement.alternate, options) : undefined,
      };
    case "while":
      return { ...statement, test: transformExpr(statement.test, options), body: transformBlock(statement.body, options) };
    case "repeat":
      return { ...statement, test: transformExpr(statement.test, options), body: transformBlock(statement.body, options) };
    case "numeric-for":
      return {
        ...statement,
        start: transformExpr(statement.start, options),
        stop: transformExpr(statement.stop, options),
        step: statement.step ? transformExpr(statement.step, options) : undefined,
        body: transformBlock(statement.body, options),
      };
    case "generic-for":
      return {
        ...statement,
        iterators: statement.iterators.map((iterator) => transformExpr(iterator, options)),
        body: transformBlock(statement.body, options),
      };
    case "return":
      return { ...statement, values: statement.values.map((value) => transformExpr(value, options)) };
    case "expression-stmt":
      return { ...statement, expression: transformExpr(statement.expression, options) };
    case "do":
      return { ...statement, body: transformBlock(statement.body, options) };
    default:
      return statement;
  }
}

function transformExpr(expression: Expression, options: CleanupOptions): Expression {
  switch (expression.kind) {
    case "unary": {
      const argument = transformExpr(expression.argument, options);
      if (expression.op === "not") {
        const simplified = negateCondition(argument);
        if (simplified) {
          return simplified;
        }
      }
      return { ...expression, argument };
    }
    case "binary": {
      const left = transformExpr(expression.left, options);
      const right = transformExpr(expression.right, options);
      let rewritten: Expression = { ...expression, left, right };
      if (options.interpolatedStrings) {
        const interp = concatToInterp(rewritten);
        if (interp) {
          return interp;
        }
      }
      rewritten = normalizeComparison(rewritten);
      if (options.mathConstants) {
        return rewriteMathConstant(rewritten);
      }
      return rewritten;
    }
    case "call": {
      const call = {
        ...expression,
        callee: transformExpr(expression.callee, options),
        args: expression.args.map((arg) => transformExpr(arg, options)),
      };
      if (options.interpolatedStrings) {
        const interp = formatToInterp(call);
        if (interp) {
          return interp;
        }
      }
      return bindCallback(call, options);
    }
    case "method-call": {
      const call = {
        ...expression,
        object: transformExpr(expression.object, options),
        args: expression.args.map((arg) => transformExpr(arg, options)),
      };
      return bindCallback(call, options);
    }
    case "index":
      return { ...expression, table: transformExpr(expression.table, options), key: transformExpr(expression.key, options) };
    case "property":
      return { ...expression, object: transformExpr(expression.object, options) };
    case "table":
      return {
        ...expression,
        fields: expression.fields.map((field) => ({
          ...field,
          key: field.key ? transformExpr(field.key, options) : undefined,
          value: transformExpr(field.value, options),
        })),
      };
    case "function-expr":
      return { ...expression, body: transformBlock(expression.body, options) };
    case "paren":
      return { ...expression, expression: transformExpr(expression.expression, options) };
    case "if-expr":
      return {
        ...expression,
        test: transformExpr(expression.test, options),
        consequent: transformExpr(expression.consequent, options),
        alternate: transformExpr(expression.alternate, options),
      };
    case "interp":
      return {
        ...expression,
        parts: expression.parts.map((part) =>
          part.kind === "expr" && typeof part.value !== "string"
            ? { kind: "expr" as const, value: transformExpr(part.value, options) }
            : part,
        ),
      };
    default:
      return options.mathConstants ? rewriteMathConstant(expression) : expression;
  }
}

function annotateLocals(statement: { names: string[]; values: Expression[] }, options: CleanupOptions): Array<string | undefined> | undefined {
  if (options.typeAnnotations !== "useful") {
    return undefined;
  }
  const types = statement.values.map((value) => typeFromExpression(value));
  return types.some((type) => type) ? types : undefined;
}

function flattenElseIf(statements: Statement[]): Statement[] {
  return statements.map((statement) => {
    if (statement.kind !== "if" || !statement.alternate || statement.alternate.statements.length !== 1) {
      return statement;
    }
    const inner = statement.alternate.statements[0];
    if (!inner || inner.kind !== "if") {
      return statement;
    }
    return {
      ...statement,
      branches: [...statement.branches, { test: inner.test, body: inner.consequent }, ...inner.branches],
      alternate: inner.alternate,
    };
  });
}

function recoverIfExpressions(statements: Statement[]): Statement[] {
  const out: Statement[] = [];
  for (const statement of statements) {
    if (statement.kind !== "if" || statement.branches.length > 0 || !statement.alternate) {
      out.push(statement);
      continue;
    }
    const thenAssign = singleAssign(statement.consequent.statements);
    const elseAssign = singleAssign(statement.alternate.statements);
    if (!thenAssign || !elseAssign) {
      out.push(statement);
      continue;
    }
    const thenTarget = thenAssign.kind === "local" ? identFromName(thenAssign.names[0]) : thenAssign.targets[0];
    const elseTarget = elseAssign.kind === "local" ? identFromName(elseAssign.names[0]) : elseAssign.targets[0];
    if (!sameTarget(thenTarget, elseTarget)) {
      out.push(statement);
      continue;
    }
    const value: Expression = {
      kind: "if-expr",
      test: statement.test,
      consequent: thenAssign.values[0]!,
      branches: [],
      alternate: elseAssign.values[0]!,
    };
    if (thenAssign.kind === "local") {
      out.push({ kind: "local", names: thenAssign.names, values: [value], types: thenAssign.types });
    } else {
      out.push({ kind: "assign", targets: thenAssign.targets, values: [value] });
    }
  }
  return out;
}

function singleAssign(statements: Statement[]): Extract<Statement, { kind: "local" | "assign" }> | undefined {
  if (statements.length !== 1) {
    return undefined;
  }
  const statement = statements[0];
  if (!statement) {
    return undefined;
  }
  if ((statement.kind === "local" || statement.kind === "assign") && statement.values.length === 1 && (statement.kind === "local" ? statement.names.length === 1 : statement.targets.length === 1)) {
    return statement;
  }
  return undefined;
}

function identFromName(name: string | undefined): Expression | undefined {
  return name ? { kind: "identifier", name } : undefined;
}

function sameTarget(left: Expression | undefined, right: Expression | undefined): boolean {
  if (!left || !right) {
    return false;
  }
  if (left.kind === "identifier" && right.kind === "identifier") {
    return left.name === right.name;
  }
  return false;
}

function recoverEarlyReturns(statements: Statement[]): Statement[] {
  const out: Statement[] = [];
  for (const statement of statements) {
    if (statement.kind !== "if" || statement.branches.length > 0 || statement.alternate) {
      out.push(statement);
      continue;
    }
    if (statement.consequent.statements.length === 1 && statement.consequent.statements[0]?.kind === "return") {
      out.push(statement);
      continue;
    }
    out.push(statement);
  }
  return out;
}

function concatToInterp(expression: Expression): Expression | undefined {
  const parts: Array<{ kind: "text" | "expr"; value: string | Expression }> = [];
  const walk = (node: Expression): boolean => {
    if (node.kind === "literal" && typeof node.value === "string") {
      parts.push({ kind: "text", value: node.value });
      return true;
    }
    if (node.kind === "binary" && node.op === "..") {
      return walk(node.left) && walk(node.right);
    }
    if (node.kind === "identifier" || node.kind === "property" || node.kind === "call" || node.kind === "method-call") {
      parts.push({ kind: "expr", value: node });
      return true;
    }
    return false;
  };
  if (!walk(expression) || parts.length < 2 || !parts.some((part) => part.kind === "text")) {
    return undefined;
  }
  return { kind: "interp", parts };
}

function formatToInterp(expression: Expression): Expression | undefined {
  if (expression.kind !== "call" || expression.args.length < 1) {
    return undefined;
  }
  const callee = expression.callee;
  const isFormat =
    (callee.kind === "property" && callee.object.kind === "identifier" && callee.object.name === "string" && callee.name === "format") ||
    (callee.kind === "identifier" && callee.name === "format");
  if (!isFormat) {
    return undefined;
  }
  const template = expression.args[0];
  if (template?.kind !== "literal" || typeof template.value !== "string") {
    return undefined;
  }
  const parts: Array<{ kind: "text" | "expr"; value: string | Expression }> = [];
  const text = template.value;
  let index = 0;
  let arg = 1;
  const pattern = /%%|%s|%d|%i|%f/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    if (match.index > index) {
      parts.push({ kind: "text", value: text.slice(index, match.index) });
    }
    if (match[0] === "%%") {
      parts.push({ kind: "text", value: "%" });
    } else {
      const value = expression.args[arg++];
      if (!value) {
        return undefined;
      }
      parts.push({ kind: "expr", value });
    }
    index = match.index + match[0].length;
  }
  if (index < text.length) {
    parts.push({ kind: "text", value: text.slice(index) });
  }
  if (arg !== expression.args.length) {
    return undefined;
  }
  return { kind: "interp", parts };
}

function rewriteMathConstant(expression: Expression): Expression {
  if (expression.kind !== "literal" || typeof expression.value !== "number") {
    return expression;
  }
  for (const entry of MATH_CONSTANTS) {
    if (Math.abs(expression.value - entry.value) < 1e-12) {
      return { kind: "property", object: { kind: "identifier", name: entry.object }, name: entry.name };
    }
  }
  return expression;
}

function bindCallback(expression: Expression, options: CleanupOptions): Expression {
  if (expression.kind !== "method-call" && expression.kind !== "call") {
    return expression;
  }
  const last = expression.args.at(-1);
  if (!last || last.kind !== "function-expr") {
    return expression;
  }
  const names = callbackParamsFor(expression.kind === "method-call" ? expression : expression.callee);
  if (!names) {
    return expression;
  }
  const fn = renameFunctionParams(last, names, options);
  return { ...expression, args: [...expression.args.slice(0, -1), fn] };
}

function renameFunctionParams(fn: FunctionExpression, names: string[], options: CleanupOptions): FunctionExpression {
  const mapped = fn.params.map((param, index) => {
    const suggested = names[index];
    if (!suggested || suggested === "..." || !isValidIdentifier(suggested)) {
      return param;
    }
    if (param.startsWith("arg") || param === "value" || param === "self") {
      return suggested;
    }
    return param;
  });
  const rename = new Map<string, string>();
  fn.params.forEach((old, index) => {
    const next = mapped[index];
    if (next && next !== old) {
      rename.set(old, next);
    }
  });
  const body = renameIdentifiers(fn.body, rename);
  const paramTypes =
    options.typeAnnotations === "off"
      ? undefined
      : mapped.map((name) => (name === "player" ? "Player" : name === "character" ? "Model" : undefined));
  return { ...fn, params: mapped, paramTypes, body: transformBlock(body, options) };
}

function renameIdentifiers(body: Block, rename: Map<string, string>): Block {
  const walkExpr = (expression: Expression): Expression => {
    if (expression.kind === "identifier") {
      const next = rename.get(expression.name);
      return next ? { ...expression, name: next } : expression;
    }
    if (expression.kind === "unary") {
      return { ...expression, argument: walkExpr(expression.argument) };
    }
    if (expression.kind === "binary") {
      return { ...expression, left: walkExpr(expression.left), right: walkExpr(expression.right) };
    }
    if (expression.kind === "call") {
      return { ...expression, callee: walkExpr(expression.callee), args: expression.args.map(walkExpr) };
    }
    if (expression.kind === "method-call") {
      return { ...expression, object: walkExpr(expression.object), args: expression.args.map(walkExpr) };
    }
    if (expression.kind === "index") {
      return { ...expression, table: walkExpr(expression.table), key: walkExpr(expression.key) };
    }
    if (expression.kind === "property") {
      return { ...expression, object: walkExpr(expression.object) };
    }
    if (expression.kind === "function-expr") {
      return expression;
    }
    if (expression.kind === "paren") {
      return { ...expression, expression: walkExpr(expression.expression) };
    }
    if (expression.kind === "table") {
      return {
        ...expression,
        fields: expression.fields.map((field) => ({
          ...field,
          key: field.key ? walkExpr(field.key) : undefined,
          value: walkExpr(field.value),
        })),
      };
    }
    return expression;
  };
  const walkStmt = (statement: Statement): Statement => {
    switch (statement.kind) {
      case "local":
        return { ...statement, values: statement.values.map(walkExpr) };
      case "assign":
        return { ...statement, targets: statement.targets.map(walkExpr), values: statement.values.map(walkExpr) };
      case "expression-stmt":
        return { ...statement, expression: walkExpr(statement.expression) };
      case "return":
        return { ...statement, values: statement.values.map(walkExpr) };
      case "if":
        return {
          ...statement,
          test: walkExpr(statement.test),
          consequent: renameIdentifiers(statement.consequent, rename),
          branches: statement.branches.map((branch) => ({
            test: walkExpr(branch.test),
            body: renameIdentifiers(branch.body, rename),
          })),
          alternate: statement.alternate ? renameIdentifiers(statement.alternate, rename) : undefined,
        };
      case "while":
        return { ...statement, test: walkExpr(statement.test), body: renameIdentifiers(statement.body, rename) };
      case "repeat":
        return { ...statement, test: walkExpr(statement.test), body: renameIdentifiers(statement.body, rename) };
      case "do":
        return { ...statement, body: renameIdentifiers(statement.body, rename) };
      default:
        return statement;
    }
  };
  return { kind: "block", statements: body.statements.map(walkStmt) };
}
