import { block } from "./Ast.js";
import type {
  BinaryOperator,
  Block,
  Chunk,
  CompoundOperator,
  Expression,
  FunctionExpression,
  Statement,
  TableField,
} from "./Ast.js";
import {
  callbackParamsFor,
  eventCallbackName,
  MATH_CONSTANTS,
  typeFromExpression,
} from "../reconstruct/RobloxSemantics.js";
import { isValidIdentifier } from "../reconstruct/Naming.js";

const COMPOUND_OPS = new Set<BinaryOperator>(["+", "-", "*", "/", "%", ".."]);
const GENERIC_CLOSURE = /^function_?\d*$/;

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
  // Transform children first so nested `else if` is already flattened, then
  // absorb those into elseif branches at this level.
  let statements = body.statements.map((statement) => transformStatement(statement, options));
  statements = flattenElseIf(statements);
  // Fold before invertContinueIfs: that pass may wrap later statements into a
  // new `if` body that would otherwise skip the compound-assign rewrite.
  statements = foldCompoundAssigns(statements);
  statements = invertContinueIfs(statements);
  const withIfExpr = options.ifExpressions ? recoverIfExpressions(statements) : statements;
  const withReturnIf = options.ifExpressions ? recoverReturnIfExpressions(withIfExpr) : withIfExpr;
  const withReturns = options.earlyReturn ? recoverEarlyReturns(withReturnIf) : withReturnIf;
  const withoutDead = removeUnusedLocals(withReturns);
  const withLocalFunctions = liftLocalFunctions(withoutDead);
  const withExports = liftExportedFunctions(withLocalFunctions);
  const withNames = renameGenericClosures(withExports);
  const withCallbackParams = bindNamedCallbacks(withNames, options);
  return { kind: "block", statements: withCallbackParams };
}

/** Last identifier of `module.X` / `config:method`. */
function declarationTail(name: string): string {
  const parts = name.split(/[.:]/);
  return parts[parts.length - 1] ?? name;
}

function isNilLiteral(expression: Expression | undefined): boolean {
  return expression?.kind === "literal" && expression.value === null;
}

function dropScaffoldNilFields(fields: TableField[]): TableField[] {
  return fields.filter((field) => {
    if (!isNilLiteral(field.value)) {
      return true;
    }
    // Positional array holes can be meaningful; named/keyed nils are DUPTABLE scaffolding.
    return !field.name && !field.key;
  });
}

/** `local name = function(...) body end` becomes `local function name(...)` when
 * the closure is not immediately assigned to a table field afterwards. */
function liftLocalFunctions(statements: Statement[]): Statement[] {
  const liftedNames = new Set<string>();
  for (const statement of statements) {
    if (statement.kind === "function-decl" && !statement.local) {
      liftedNames.add(declarationTail(statement.name));
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
      line: value.line,
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
 * (they are superseded by lifted method declarations), and drop `local _ = nil`. */
function removeUnusedLocals(statements: Statement[]): Statement[] {
  const referenced = new Set<string>();
  const liftedNames = new Set<string>();
  const locals: Array<{ name: string; statement: Statement }> = [];
  for (const statement of statements) {
    if (statement.kind === "local" && statement.names.length === 1) {
      locals.push({ name: statement.names[0]!, statement });
    }
    if (statement.kind === "function-decl" && !statement.local) {
      liftedNames.add(declarationTail(statement.name));
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
    const value = statement.values[0];
    // `_` is the unused-binding convention; a nil initializer is dead.
    if (name === "_" && (statement.values.length === 0 || isNilLiteral(value))) {
      return false;
    }
    const local = locals.find((candidate) => candidate.statement === statement);
    if (!local || referenced.has(name)) {
      return true;
    }
    if (statement.values.length === 0 || isNilLiteral(value)) {
      return false;
    }
    if (!value || value.kind !== "function-expr") {
      return true;
    }
    // Drop closure locals superseded by a lifted method/field declaration.
    return !liftedNames.has(name);
  });
}

function foldCompoundAssigns(statements: Statement[]): Statement[] {
  return statements.map((statement) => {
    if (statement.kind !== "assign" || statement.targets.length !== 1 || statement.values.length !== 1) {
      return statement;
    }
    const target = statement.targets[0]!;
    const value = statement.values[0]!;
    if (value.kind !== "binary" || !COMPOUND_OPS.has(value.op)) {
      return statement;
    }
    if (!isSafeCompoundTarget(target) || !sameCompoundTarget(target, value.left)) {
      return statement;
    }
    return { kind: "compound-assign", target, op: value.op as CompoundOperator, value: value.right };
  });
}

function isSafeCompoundTarget(expression: Expression): boolean {
  if (expression.kind === "identifier") {
    return true;
  }
  // `obj.field += x` is safe when `obj` is a plain identifier (no re-eval).
  return expression.kind === "property" && expression.object.kind === "identifier";
}

function sameCompoundTarget(target: Expression, left: Expression): boolean {
  if (target.kind === "identifier" && left.kind === "identifier") {
    return target.name === left.name;
  }
  if (target.kind === "property" && left.kind === "property") {
    return target.name === left.name && sameCompoundTarget(target.object, left.object);
  }
  return false;
}

function asFunctionExpr(statement: Statement): FunctionExpression | undefined {
  if (statement.kind === "function-decl") {
    return {
      kind: "function-expr",
      params: statement.params,
      paramTypes: statement.paramTypes,
      returnType: statement.returnType,
      isVararg: statement.isVararg,
      body: statement.body,
      line: statement.line,
    };
  }
  if (statement.kind === "local" && statement.names.length === 1 && statement.values.length === 1) {
    const value = statement.values[0];
    return value?.kind === "function-expr" ? value : undefined;
  }
  if (statement.kind === "assign" && statement.values.length === 1) {
    const value = statement.values[0];
    return value?.kind === "function-expr" ? value : undefined;
  }
  return undefined;
}

/** `local function X(...) ... end; module.X = X` (or `local X; X = function`)
 * becomes `function module.X(...)` when X is otherwise unused. */
function liftExportedFunctions(statements: Statement[]): Statement[] {
  type LocalFn = {
    name: string;
    fn: FunctionExpression;
    declare: Statement;
    assign?: Statement;
  };
  const locals = new Map<string, LocalFn>();
  for (const statement of statements) {
    if (statement.kind === "function-decl" && statement.local && !statement.name.includes(".") && !statement.name.includes(":")) {
      const fn = asFunctionExpr(statement);
      if (fn) {
        locals.set(statement.name, { name: statement.name, fn, declare: statement });
      }
    } else if (statement.kind === "local" && statement.names.length === 1) {
      const name = statement.names[0]!;
      const value = statement.values[0];
      if (value?.kind === "function-expr") {
        locals.set(name, { name, fn: value, declare: statement });
      } else if (statement.values.length === 0) {
        locals.set(name, { name, fn: { kind: "function-expr", params: [], isVararg: false, body: block() }, declare: statement });
      }
    } else if (statement.kind === "assign" && statement.targets.length === 1 && statement.values.length === 1) {
      const target = statement.targets[0]!;
      const value = statement.values[0]!;
      if (target.kind === "identifier" && value.kind === "function-expr") {
        const existing = locals.get(target.name);
        if (existing && existing.declare.kind === "local" && existing.declare.values.length === 0) {
          existing.fn = value;
          existing.assign = statement;
        }
      }
    }
  }

  const exports = new Map<string, { statement: Statement; object: Expression; field: string }>();
  for (const statement of statements) {
    if (statement.kind !== "assign" || statement.targets.length !== 1 || statement.values.length !== 1) {
      continue;
    }
    const target = statement.targets[0]!;
    const value = statement.values[0]!;
    if (target.kind === "property" && target.object.kind === "identifier" && value.kind === "identifier" && locals.has(value.name)) {
      // Prefer the first export of each local.
      if (!exports.has(value.name)) {
        exports.set(value.name, { statement, object: target.object, field: target.name });
      }
    }
  }

  const skip = new Set<Statement>();
  const replacements = new Map<Statement, Statement>();
  for (const [name, local] of locals) {
    const exported = exports.get(name);
    if (!exported || !isValidIdentifier(exported.field)) {
      continue;
    }
    const ignored = new Set<Statement>([local.declare, exported.statement]);
    if (local.assign) {
      ignored.add(local.assign);
    }
    if (countNameUses(statements, name, ignored) > 0) {
      continue;
    }
    const receiver = firstParamIsReceiver(local.fn);
    const table = exported.object.kind === "identifier" ? exported.object.name : undefined;
    if (!table) {
      continue;
    }
    const lifted: Statement = {
      kind: "function-decl",
      local: false,
      name: `${table}${receiver ? ":" : "."}${exported.field}`,
      params: receiver ? local.fn.params.slice(1) : local.fn.params,
      paramTypes: receiver ? local.fn.paramTypes?.slice(1) : local.fn.paramTypes,
      returnType: local.fn.returnType,
      isVararg: local.fn.isVararg,
      body: receiver && local.fn.params[0] ? renameIdentifiers(local.fn.body, new Map([[local.fn.params[0], "self"]])) : local.fn.body,
    };
    skip.add(local.declare);
    if (local.assign) {
      skip.add(local.assign);
    }
    replacements.set(exported.statement, lifted);
  }

  if (skip.size === 0 && replacements.size === 0) {
    return statements;
  }
  return statements.flatMap((statement) => {
    if (skip.has(statement)) {
      return [];
    }
    return [replacements.get(statement) ?? statement];
  });
}

function countNameUses(statements: Statement[], name: string, ignored: Set<Statement>): number {
  let count = 0;
  for (const statement of statements) {
    if (ignored.has(statement)) {
      continue;
    }
    collectIdentifiers(statement, (candidate) => {
      if (candidate === name) {
        count += 1;
      }
    });
  }
  return count;
}

function firstParamIsReceiver(fn: FunctionExpression): boolean {
  const first = fn.params[0];
  if (!first) {
    return false;
  }
  let receiver = false;
  for (const statement of fn.body.statements) {
    walkForReceiver(statement, first, () => {
      receiver = true;
    });
    if (receiver) {
      return true;
    }
  }
  return false;
}

function walkForReceiver(statement: Statement, first: string, hit: () => void): void {
  const visit = (expression: Expression): void => {
    switch (expression.kind) {
      case "property":
        if (expression.object.kind === "identifier" && expression.object.name === first) {
          hit();
        }
        visit(expression.object);
        break;
      case "index":
        if (expression.table.kind === "identifier" && expression.table.name === first) {
          hit();
        }
        visit(expression.table);
        visit(expression.key);
        break;
      case "method-call":
        if (expression.object.kind === "identifier" && expression.object.name === first) {
          hit();
        }
        visit(expression.object);
        expression.args.forEach(visit);
        break;
      case "call":
        visit(expression.callee);
        expression.args.forEach(visit);
        break;
      case "binary":
        visit(expression.left);
        visit(expression.right);
        break;
      case "unary":
        visit(expression.argument);
        break;
      case "table":
        expression.fields.forEach((field) => {
          if (field.key) {
            visit(field.key);
          }
          visit(field.value);
        });
        break;
      case "if-expr":
        visit(expression.test);
        visit(expression.consequent);
        expression.branches.forEach((branch) => {
          visit(branch.test);
          visit(branch.value);
        });
        visit(expression.alternate);
        break;
      case "interp":
        expression.parts.forEach((part) => {
          if (part.kind === "expr" && typeof part.value !== "string") {
            visit(part.value);
          }
        });
        break;
      case "paren":
        visit(expression.expression);
        break;
      default:
        break;
    }
  };
  const visitStmt = (item: Statement): void => {
    switch (item.kind) {
      case "local":
        item.values.forEach(visit);
        break;
      case "assign":
        item.targets.forEach(visit);
        item.values.forEach(visit);
        break;
      case "compound-assign":
        visit(item.target);
        visit(item.value);
        break;
      case "expression-stmt":
        visit(item.expression);
        break;
      case "return":
        item.values.forEach(visit);
        break;
      case "if":
        visit(item.test);
        item.consequent.statements.forEach(visitStmt);
        item.branches.forEach((branch) => {
          visit(branch.test);
          branch.body.statements.forEach(visitStmt);
        });
        item.alternate?.statements.forEach(visitStmt);
        break;
      case "while":
        visit(item.test);
        item.body.statements.forEach(visitStmt);
        break;
      case "repeat":
        item.body.statements.forEach(visitStmt);
        visit(item.test);
        break;
      case "numeric-for":
        visit(item.start);
        visit(item.stop);
        if (item.step) {
          visit(item.step);
        }
        item.body.statements.forEach(visitStmt);
        break;
      case "generic-for":
        item.iterators.forEach(visit);
        item.body.statements.forEach(visitStmt);
        break;
      case "do":
        item.body.statements.forEach(visitStmt);
        break;
     case "function-decl":
        item.body.statements.forEach(visitStmt);
        break;
      default:
        break;
    }
  };
  visitStmt(statement);
}

function renameGenericClosures(statements: Statement[]): Statement[] {
  const used = new Set<string>();
  for (const statement of statements) {
    collectIdentifiers(statement, (name) => used.add(name));
    if (statement.kind === "local") {
      statement.names.forEach((name) => used.add(name));
    }
    if (statement.kind === "function-decl") {
      used.add(declarationTail(statement.name));
    }
  }

  const bindings = new Map<string, { declare: Statement; assign?: Statement }>();
  for (const statement of statements) {
    if (statement.kind === "function-decl" && statement.local && GENERIC_CLOSURE.test(statement.name)) {
      bindings.set(statement.name, { declare: statement });
    } else if (statement.kind === "local" && statement.names.length === 1 && GENERIC_CLOSURE.test(statement.names[0]!)) {
      bindings.set(statement.names[0]!, { declare: statement });
    } else if (statement.kind === "assign" && statement.targets.length === 1 && statement.values[0]?.kind === "function-expr") {
      const target = statement.targets[0]!;
      if (target.kind === "identifier" && GENERIC_CLOSURE.test(target.name)) {
        const existing = bindings.get(target.name);
        if (existing) {
          existing.assign = statement;
        }
      }
    }
  }

  const rename = new Map<string, string>();
  for (const [name, binding] of bindings) {
    if (hasNonFunctionAssignment(statements, name, binding)) {
      continue;
    }
    const role = inferClosureRole(statements, name);
    if (!role || role === name) {
      continue;
    }
    const next = allocateName(role, used);
    used.add(next);
    rename.set(name, next);
  }
  if (rename.size === 0) {
    return statements;
  }
  return statements.map((statement) => renameStatementNames(statement, rename));
}

function hasNonFunctionAssignment(statements: Statement[], name: string, binding: { declare: Statement; assign?: Statement }): boolean {
  for (const statement of statements) {
    if (statement === binding.declare || statement === binding.assign) {
      continue;
    }
    if (statement.kind === "assign" && statement.targets.some((target) => target.kind === "identifier" && target.name === name)) {
      return statement.values.some((value) => value.kind !== "function-expr");
    }
    if (statement.kind === "compound-assign" && statement.target.kind === "identifier" && statement.target.name === name) {
      return true;
    }
  }
  return false;
}

function inferClosureRole(statements: Statement[], name: string): string | undefined {
  let role: string | undefined;
  const consider = (candidate: string | undefined): void => {
    if (candidate) {
      role = candidate;
    }
  };
  const visit = (expression: Expression): void => {
    switch (expression.kind) {
      case "method-call": {
        const last = expression.args.at(-1);
        if (last?.kind === "identifier" && last.name === name) {
          if (expression.name === "Connect" || expression.name === "Once") {
            if (expression.object.kind === "property") {
              consider(eventCallbackName(expression.object.name));
            } else {
              consider("callback");
            }
          } else if (expression.name === "Observe" || expression.name === "ObserveKeys") {
            consider("observer");
          }
        }
        visit(expression.object);
        expression.args.forEach(visit);
        break;
      }
      case "call": {
        const last = expression.args.at(-1);
        if (last?.kind === "identifier" && last.name === name) {
          consider(roleFromCallee(expression.callee, expression.args, name) ?? "callback");
        }
        visit(expression.callee);
        expression.args.forEach(visit);
        break;
      }
      case "unary":
        visit(expression.argument);
        break;
      case "binary":
        visit(expression.left);
        visit(expression.right);
        break;
      case "index":
        visit(expression.table);
        visit(expression.key);
        break;
      case "property":
        visit(expression.object);
        break;
      case "table":
        expression.fields.forEach((field) => {
          if (field.key) {
            visit(field.key);
          }
          if (field.value.kind === "identifier" && field.value.name === name && field.name) {
            consider(field.name);
          }
          visit(field.value);
        });
        break;
      case "function-expr":
        break;
      case "paren":
        visit(expression.expression);
        break;
      case "if-expr":
        visit(expression.test);
        visit(expression.consequent);
        expression.branches.forEach((branch) => {
          visit(branch.test);
          visit(branch.value);
        });
        visit(expression.alternate);
        break;
      case "interp":
        expression.parts.forEach((part) => {
          if (part.kind === "expr" && typeof part.value !== "string") {
            visit(part.value);
          }
        });
        break;
      default:
        break;
    }
  };
  const visitStmt = (statement: Statement): void => {
    switch (statement.kind) {
      case "local":
        statement.values.forEach(visit);
        break;
      case "assign":
        if (
          statement.targets.length === 1 &&
          statement.values.length === 1 &&
          statement.targets[0]?.kind === "property" &&
          statement.values[0]?.kind === "identifier" &&
          statement.values[0].name === name
        ) {
          consider(statement.targets[0].name);
        }
        statement.targets.forEach(visit);
        statement.values.forEach(visit);
        break;
      case "compound-assign":
        visit(statement.target);
        visit(statement.value);
        break;
      case "expression-stmt":
        visit(statement.expression);
        break;
      case "return":
        statement.values.forEach(visit);
        break;
      case "if":
        visit(statement.test);
        statement.consequent.statements.forEach(visitStmt);
        statement.branches.forEach((branch) => {
          visit(branch.test);
          branch.body.statements.forEach(visitStmt);
        });
        statement.alternate?.statements.forEach(visitStmt);
        break;
      case "while":
        visit(statement.test);
        statement.body.statements.forEach(visitStmt);
        break;
      case "repeat":
        statement.body.statements.forEach(visitStmt);
        visit(statement.test);
        break;
      case "numeric-for":
        visit(statement.start);
        visit(statement.stop);
        if (statement.step) {
          visit(statement.step);
        }
        statement.body.statements.forEach(visitStmt);
        break;
      case "generic-for":
        statement.iterators.forEach(visit);
        statement.body.statements.forEach(visitStmt);
        break;
      case "do":
        statement.body.statements.forEach(visitStmt);
        break;
      case "function-decl":
        statement.body.statements.forEach(visitStmt);
        break;
      default:
        break;
    }
  };
  statements.forEach(visitStmt);
  return role;
}

function roleFromCallee(callee: Expression, args: Expression[], name: string): string | undefined {
  if (callee.kind === "property") {
    if (callee.object.kind === "identifier" && callee.object.name === "table" && callee.name === "sort") {
      return "compare";
    }
    if (callee.object.kind === "identifier" && callee.object.name === "coroutine" && callee.name === "create") {
      return "routine";
    }
    if (callee.object.kind === "identifier" && callee.object.name === "task") {
      if (callee.name === "delay") {
        return "delayed";
      }
      if (callee.name === "spawn") {
        return "spawned";
      }
    }
    if (callee.name === "Connect" || callee.name === "Once") {
      return callee.object.kind === "property" ? eventCallbackName(callee.object.name) : "callback";
    }
    if (callee.name === "Observe" || callee.name === "ObserveKeys") {
      return "observer";
    }
    if (callee.name === "new" && callee.object.kind === "identifier" && /Shake/i.test(callee.object.name)) {
      return "onShake";
    }
  }
  if (callee.kind === "identifier") {
    if (callee.name === "xpcall") {
      return args[1]?.kind === "identifier" && args[1].name === name ? "onError" : "protected";
    }
    if (callee.name === "pcall") {
      return "protected";
    }
  }
  return undefined;
}

/** Rename params of `local function X` when X is passed to Connect/Once/etc. */
function bindNamedCallbacks(statements: Statement[], options: CleanupOptions): Statement[] {
  const paramsFor = new Map<string, string[]>();
  const collectFromExpr = (expression: Expression): void => {
    if (expression.kind === "method-call" || expression.kind === "call") {
      const last = expression.args.at(-1);
      if (last?.kind === "identifier") {
        const names = callbackParamsFor(expression.kind === "method-call" ? expression : expression.callee);
        if (names && names.length > 0 && names[0] !== "...") {
          paramsFor.set(last.name, names);
        }
      }
      if (expression.kind === "method-call") {
        collectFromExpr(expression.object);
      } else {
        collectFromExpr(expression.callee);
      }
      expression.args.forEach(collectFromExpr);
      return;
    }
    if (expression.kind === "unary") {
      collectFromExpr(expression.argument);
    } else if (expression.kind === "binary") {
      collectFromExpr(expression.left);
      collectFromExpr(expression.right);
    } else if (expression.kind === "property") {
      collectFromExpr(expression.object);
    } else if (expression.kind === "index") {
      collectFromExpr(expression.table);
      collectFromExpr(expression.key);
    } else if (expression.kind === "table") {
      expression.fields.forEach((field) => {
        if (field.key) {
          collectFromExpr(field.key);
        }
        collectFromExpr(field.value);
      });
    } else if (expression.kind === "if-expr") {
      collectFromExpr(expression.test);
      collectFromExpr(expression.consequent);
      expression.branches.forEach((branch) => {
        collectFromExpr(branch.test);
        collectFromExpr(branch.value);
      });
      collectFromExpr(expression.alternate);
    }
  };
  const collectFromStmt = (statement: Statement): void => {
    switch (statement.kind) {
      case "local":
        statement.values.forEach(collectFromExpr);
        break;
      case "assign":
        statement.targets.forEach(collectFromExpr);
        statement.values.forEach(collectFromExpr);
        break;
      case "compound-assign":
        collectFromExpr(statement.target);
        collectFromExpr(statement.value);
        break;
      case "expression-stmt":
        collectFromExpr(statement.expression);
        break;
      case "return":
        statement.values.forEach(collectFromExpr);
        break;
      case "if":
        collectFromExpr(statement.test);
        statement.consequent.statements.forEach(collectFromStmt);
        statement.branches.forEach((branch) => {
          collectFromExpr(branch.test);
          branch.body.statements.forEach(collectFromStmt);
        });
        statement.alternate?.statements.forEach(collectFromStmt);
        break;
      case "while":
        collectFromExpr(statement.test);
        statement.body.statements.forEach(collectFromStmt);
        break;
      case "repeat":
        statement.body.statements.forEach(collectFromStmt);
        collectFromExpr(statement.test);
        break;
      case "function-decl":
        statement.body.statements.forEach(collectFromStmt);
        break;
      default:
        break;
    }
  };
  statements.forEach(collectFromStmt);
  if (paramsFor.size === 0) {
    return statements;
  }
  return statements.map((statement) => {
    if (statement.kind === "function-decl" && statement.local) {
      const names = paramsFor.get(statement.name);
      if (names) {
        const remapped = remapCallbackParams(statement.params, statement.body, names, options);
        return { ...statement, params: remapped.params, paramTypes: remapped.paramTypes, body: remapped.body };
      }
    }
    if (statement.kind === "local" && statement.names.length === 1 && statement.values[0]?.kind === "function-expr") {
      const names = paramsFor.get(statement.names[0]!);
      if (names) {
        const fn = statement.values[0];
        const remapped = remapCallbackParams(fn.params, fn.body, names, options);
        return { ...statement, values: [{ ...fn, params: remapped.params, paramTypes: remapped.paramTypes, body: remapped.body }] };
      }
    }
    if (
      statement.kind === "assign" &&
      statement.targets[0]?.kind === "identifier" &&
      statement.values[0]?.kind === "function-expr"
    ) {
      const names = paramsFor.get(statement.targets[0].name);
      if (names) {
        const fn = statement.values[0];
        const remapped = remapCallbackParams(fn.params, fn.body, names, options);
        return { ...statement, values: [{ ...fn, params: remapped.params, paramTypes: remapped.paramTypes, body: remapped.body }] };
      }
    }
    return statement;
  });
}

function remapCallbackParams(
  params: string[],
  body: Block,
  names: string[],
  options: CleanupOptions,
): { params: string[]; paramTypes?: Array<string | undefined>; body: Block } {
  const mapped = params.map((param, index) => {
    const suggested = names[index];
    if (!suggested || suggested === "..." || !isValidIdentifier(suggested)) {
      return param;
    }
    if (param.startsWith("arg") || param === "value" || param === "self" || /^value\d+$/.test(param)) {
      return suggested;
    }
    return param;
  });
  const rename = new Map<string, string>();
  params.forEach((old, index) => {
    const next = mapped[index];
    if (next && next !== old) {
      rename.set(old, next);
    }
  });
  const paramTypes =
    options.typeAnnotations === "off"
      ? undefined
      : mapped.map((name) => (name === "player" ? "Player" : name === "character" ? "Model" : name === "cframe" ? "CFrame" : undefined));
  return { params: mapped, paramTypes, body: rename.size > 0 ? renameIdentifiers(body, rename) : body };
}

function allocateName(preferred: string, used: Set<string>): string {
  const base = isValidIdentifier(preferred) ? preferred : "callback";
  if (!used.has(base)) {
    return base;
  }
  let suffix = 2;
  while (used.has(`${base}${suffix}`)) {
    suffix += 1;
  }
  return `${base}${suffix}`;
}

function renameStatementNames(statement: Statement, rename: Map<string, string>): Statement {
  const mapped = (name: string): string => rename.get(name) ?? name;
  switch (statement.kind) {
    case "local":
      return {
        ...statement,
        names: statement.names.map(mapped),
        values: statement.values.map((value) => renameExpr(value, rename)),
      };
    case "assign":
      return {
        ...statement,
        targets: statement.targets.map((target) => renameExpr(target, rename)),
        values: statement.values.map((value) => renameExpr(value, rename)),
      };
    case "compound-assign":
      return { ...statement, target: renameExpr(statement.target, rename), value: renameExpr(statement.value, rename) };
    case "function-decl": {
      const name = statement.local ? mapped(statement.name) : statement.name;
      return { ...statement, name, body: renameIdentifiers(statement.body, rename) };
    }
    case "expression-stmt":
      return { ...statement, expression: renameExpr(statement.expression, rename) };
    case "return":
      return { ...statement, values: statement.values.map((value) => renameExpr(value, rename)) };
    case "if":
      return {
        ...statement,
        test: renameExpr(statement.test, rename),
        consequent: renameIdentifiers(statement.consequent, rename),
        branches: statement.branches.map((branch) => ({
          test: renameExpr(branch.test, rename),
          body: renameIdentifiers(branch.body, rename),
        })),
        alternate: statement.alternate ? renameIdentifiers(statement.alternate, rename) : undefined,
      };
    case "while":
      return { ...statement, test: renameExpr(statement.test, rename), body: renameIdentifiers(statement.body, rename) };
    case "repeat":
      return { ...statement, test: renameExpr(statement.test, rename), body: renameIdentifiers(statement.body, rename) };
    case "numeric-for":
      return {
        ...statement,
        start: renameExpr(statement.start, rename),
        stop: renameExpr(statement.stop, rename),
        step: statement.step ? renameExpr(statement.step, rename) : undefined,
        body: renameIdentifiers(statement.body, rename),
      };
    case "generic-for":
      return {
        ...statement,
        iterators: statement.iterators.map((iterator) => renameExpr(iterator, rename)),
        body: renameIdentifiers(statement.body, rename),
      };
    case "do":
      return { ...statement, body: renameIdentifiers(statement.body, rename) };
    default:
      return statement;
  }
}

function renameExpr(expression: Expression, rename: Map<string, string>): Expression {
  if (expression.kind === "identifier") {
    const next = rename.get(expression.name);
    return next ? { ...expression, name: next } : expression;
  }
  if (expression.kind === "unary") {
    return { ...expression, argument: renameExpr(expression.argument, rename) };
  }
  if (expression.kind === "binary") {
    return { ...expression, left: renameExpr(expression.left, rename), right: renameExpr(expression.right, rename) };
  }
  if (expression.kind === "call") {
    return { ...expression, callee: renameExpr(expression.callee, rename), args: expression.args.map((arg) => renameExpr(arg, rename)) };
  }
  if (expression.kind === "method-call") {
    return { ...expression, object: renameExpr(expression.object, rename), args: expression.args.map((arg) => renameExpr(arg, rename)) };
  }
  if (expression.kind === "index") {
    return { ...expression, table: renameExpr(expression.table, rename), key: renameExpr(expression.key, rename) };
  }
  if (expression.kind === "property") {
    return { ...expression, object: renameExpr(expression.object, rename) };
  }
  if (expression.kind === "function-expr") {
    return { ...expression, body: renameIdentifiers(expression.body, rename) };
  }
  if (expression.kind === "paren") {
    return { ...expression, expression: renameExpr(expression.expression, rename) };
  }
  if (expression.kind === "table") {
    return {
      ...expression,
      fields: expression.fields.map((field) => ({
        ...field,
        key: field.key ? renameExpr(field.key, rename) : undefined,
        value: renameExpr(field.value, rename),
      })),
    };
  }
  if (expression.kind === "if-expr") {
    return {
      ...expression,
      test: renameExpr(expression.test, rename),
      consequent: renameExpr(expression.consequent, rename),
      branches: expression.branches.map((branch) => ({
        test: renameExpr(branch.test, rename),
        value: renameExpr(branch.value, rename),
      })),
      alternate: renameExpr(expression.alternate, rename),
    };
  }
  if (expression.kind === "interp") {
    return {
      ...expression,
      parts: expression.parts.map((part) =>
        part.kind === "expr" && typeof part.value !== "string"
          ? { kind: "expr" as const, value: renameExpr(part.value, rename) }
          : part,
      ),
    };
  }
  return expression;
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
      case "compound-assign":
        walkExpr(item.target);
        walkExpr(item.value);
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
    case "compound-assign":
      return {
        ...statement,
        target: transformExpr(statement.target, options),
        value: transformExpr(statement.value, options),
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
        fields: dropScaffoldNilFields(
          expression.fields.map((field) => ({
            ...field,
            key: field.key ? transformExpr(field.key, options) : undefined,
            value: transformExpr(field.value, options),
          })),
        ),
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
  const useful = types.map((type) => (type && type !== "nil" ? type : undefined));
  return useful.some((type) => type) ? useful : undefined;
}

function flattenElseIf(statements: Statement[]): Statement[] {
  return statements.map((statement) => flattenOneIf(statement));
}

function flattenOneIf(statement: Statement): Statement {
  if (statement.kind !== "if" || !statement.alternate) {
    return statement;
  }
  let current = statement;
  while (
    current.alternate &&
    current.alternate.statements.length === 1 &&
    current.alternate.statements[0]?.kind === "if"
  ) {
    const inner = current.alternate.statements[0];
    current = {
      ...current,
      branches: [...current.branches, { test: inner.test, body: inner.consequent }, ...inner.branches],
      alternate: inner.alternate,
    };
  }
  return current;
}

/** `if cond then return a else return b end` → `return if cond then a else b`. */
function recoverReturnIfExpressions(statements: Statement[]): Statement[] {
  return statements.map((statement) => {
    if (statement.kind !== "if") {
      return statement;
    }
    const thenReturn = singleReturn(statement.consequent.statements);
    if (!thenReturn) {
      return statement;
    }
    const branchReturns: Array<{ test: Expression; value: Expression }> = [];
    for (const branch of statement.branches) {
      const ret = singleReturn(branch.body.statements);
      if (!ret || ret.values.length !== thenReturn.values.length) {
        return statement;
      }
      if (thenReturn.values.length === 1) {
        branchReturns.push({ test: branch.test, value: ret.values[0]! });
      } else {
        return statement;
      }
    }
    if (!statement.alternate) {
      return statement;
    }
    const elseReturn = singleReturn(statement.alternate.statements);
    if (!elseReturn || elseReturn.values.length !== thenReturn.values.length || thenReturn.values.length !== 1) {
      return statement;
    }
    let expr: Expression = {
      kind: "if-expr",
      test: statement.test,
      consequent: thenReturn.values[0]!,
      branches: branchReturns,
      alternate: elseReturn.values[0]!,
    };
    // Inner transform may already have turned the else into `return if ...`.
    const alt = elseReturn.values[0]!;
    if (branchReturns.length === 0 && alt.kind === "if-expr") {
      expr = {
        kind: "if-expr",
        test: statement.test,
        consequent: thenReturn.values[0]!,
        branches: [{ test: alt.test, value: alt.consequent }, ...alt.branches],
        alternate: alt.alternate,
      };
    }
    return { kind: "return", values: [expr] };
  });
}

function singleReturn(statements: Statement[]): Extract<Statement, { kind: "return" }> | undefined {
  if (statements.length !== 1 || statements[0]?.kind !== "return") {
    return undefined;
  }
  return statements[0];
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

