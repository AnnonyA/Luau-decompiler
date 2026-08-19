import type { Block, Chunk, Expression, Statement } from "../ast/Ast.js";
import { isValidIdentifier } from "./Naming.js";

/** Hints collected from a live Roblox session (see `scripts/collect-context.luau`). */
export interface RuntimeContext {
  /** In-game name of the ModuleScript / LocalScript. */
  scriptName?: string;
  /** Preferred name for the returned module table (`module` → this). */
  moduleName?: string;
  /** Extra identifier remaps gathered from the executor environment. */
  names?: Record<string, string>;
}

export function parseRuntimeContext(value: unknown): RuntimeContext | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const raw = value as Record<string, unknown>;
  const names =
    raw.names && typeof raw.names === "object" && !Array.isArray(raw.names)
      ? Object.fromEntries(
          Object.entries(raw.names as Record<string, unknown>).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string",
          ),
        )
      : undefined;
  return {
    scriptName: typeof raw.scriptName === "string" ? raw.scriptName : undefined,
    moduleName: typeof raw.moduleName === "string" ? raw.moduleName : undefined,
    names,
  };
}

/** Rename the reconstructed module / locals using live-game hints. */
export function applyRuntimeContext(ast: Chunk, context: RuntimeContext | false | undefined): Chunk {
  if (!context) {
    return ast;
  }
  const rename = new Map<string, string>();
  const moduleName = context.moduleName ?? context.scriptName;
  if (moduleName && isValidIdentifier(moduleName)) {
    rename.set("module", moduleName);
  }
  for (const [from, to] of Object.entries(context.names ?? {})) {
    if (isValidIdentifier(from) && isValidIdentifier(to) && from !== to) {
      rename.set(from, to);
    }
  }
  if (rename.size === 0) {
    return ast;
  }
  return { kind: "chunk", body: renameBlock(ast.body, rename) };
}

function renameDeclName(name: string, rename: Map<string, string>): string {
  return name
    .split(".")
    .map((part) => {
      const [head, ...rest] = part.split(":");
      const mapped = rename.get(head ?? "") ?? head ?? "";
      return [mapped, ...rest].join(":");
    })
    .join(".");
}

function renameBlock(body: Block, rename: Map<string, string>): Block {
  return { kind: "block", statements: body.statements.map((statement) => renameStmt(statement, rename)) };
}

function renameStmt(statement: Statement, rename: Map<string, string>): Statement {
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
    case "function-decl":
      return {
        ...statement,
        name: statement.local ? mapped(statement.name) : renameDeclName(statement.name, rename),
        body: renameBlock(statement.body, rename),
      };
    case "expression-stmt":
      return { ...statement, expression: renameExpr(statement.expression, rename) };
    case "return":
      return { ...statement, values: statement.values.map((value) => renameExpr(value, rename)) };
    case "if":
      return {
        ...statement,
        test: renameExpr(statement.test, rename),
        consequent: renameBlock(statement.consequent, rename),
        branches: statement.branches.map((branch) => ({
          test: renameExpr(branch.test, rename),
          body: renameBlock(branch.body, rename),
        })),
        alternate: statement.alternate ? renameBlock(statement.alternate, rename) : undefined,
      };
    case "while":
      return { ...statement, test: renameExpr(statement.test, rename), body: renameBlock(statement.body, rename) };
    case "repeat":
      return { ...statement, test: renameExpr(statement.test, rename), body: renameBlock(statement.body, rename) };
    case "numeric-for":
      return {
        ...statement,
        start: renameExpr(statement.start, rename),
        stop: renameExpr(statement.stop, rename),
        step: statement.step ? renameExpr(statement.step, rename) : undefined,
        body: renameBlock(statement.body, rename),
      };
    case "generic-for":
      return {
        ...statement,
        iterators: statement.iterators.map((iterator) => renameExpr(iterator, rename)),
        body: renameBlock(statement.body, rename),
      };
    case "do":
      return { ...statement, body: renameBlock(statement.body, rename) };
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
    return { ...expression, body: renameBlock(expression.body, rename) };
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
  return expression;
}
