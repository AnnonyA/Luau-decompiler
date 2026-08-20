import type { Block, Chunk, Expression, Statement } from "../ast/Ast.js";
import {
  inferHumanNames as inferHumanNamesCore,
  isGeneratedName,
  repairUndeclaredAutoLocals,
} from "./NameInferenceCore.js";

export { isGeneratedName, repairUndeclaredAutoLocals };

export function inferHumanNames(ast: Chunk): Chunk {
  const protectedAst = structuredClone(ast);
  protectBlock(protectedAst.body);
  return inferHumanNamesCore(protectedAst);
}

function protectBlock(body: Block): void {
  const used = new Set<string>();
  for (const statement of body.statements) {
    if (statement.kind === "local") {
      statement.names.forEach((name) => used.add(name));
    } else if (statement.kind === "function-decl" && statement.local) {
      used.add(statement.name);
    }
  }

  for (const statement of body.statements) {
    if (statement.kind !== "local" || statement.names.length !== 1 || statement.values.length !== 1) {
      continue;
    }
    const oldName = statement.names[0]!;
    const init = statement.values[0];
    if (!isGeneratedName(oldName) || !init || !capturedByNestedFunction(body, oldName)) {
      continue;
    }

    let hint: string | undefined;
    if (init.kind === "literal" && init.value === 0 && capturedSelectCount(body, oldName)) {
      hint = "count";
    } else if (init.kind === "literal" && init.value === null && assignedFromConnection(body.statements, oldName)) {
      hint = "connection";
    }
    if (!hint) {
      continue;
    }

    const nextName = reserve(hint, oldName, used);
    renameInBlock(body, oldName, nextName);
  }

  walk(body.statements, (node) => {
    if (node.kind === "block") {
      protectBlock(node as unknown as Block);
      return false;
    }
    return true;
  });
}

function assignedFromConnection(statements: Statement[], name: string): boolean {
  return statements.some(
    (statement) =>
      statement.kind === "assign" &&
      statement.targets.length === 1 &&
      statement.targets[0]?.kind === "identifier" &&
      statement.targets[0].name === name &&
      statement.values.length === 1 &&
      statement.values[0]?.kind === "method-call" &&
      (statement.values[0].name === "Connect" || statement.values[0].name === "Once"),
  );
}

function capturedByNestedFunction(body: Block, name: string): boolean {
  return nestedSome(body.statements, name, 0, (node, depth) =>
    depth > 0 && node.kind === "identifier" && node.name === name,
  );
}

function capturedSelectCount(body: Block, name: string): boolean {
  return nestedSome(body.statements, name, 0, (node, depth) => {
    if (depth === 0 || node.kind !== "compound-assign") {
      return false;
    }
    const statement = node as unknown as Extract<Statement, { kind: "compound-assign" }>;
    return statement.op === "+" &&
      statement.target.kind === "identifier" &&
      statement.target.name === name &&
      isSelectCount(statement.value);
  });
}

function nestedSome(
  value: unknown,
  name: string,
  depth: number,
  match: (node: Record<string, unknown>, depth: number) => boolean,
): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => nestedSome(item, name, depth, match));
  }
  if (!value || typeof value !== "object") {
    return false;
  }
  const node = value as Record<string, unknown>;
  let nextDepth = depth;
  if (isFunction(node)) {
    if (node.params.includes(name)) {
      return false;
    }
    nextDepth += 1;
  }
  if (match(node, nextDepth)) {
    return true;
  }
  return Object.values(node).some((child) => nestedSome(child, name, nextDepth, match));
}

function isSelectCount(expression: Expression): boolean {
  return expression.kind === "call" &&
    expression.callee.kind === "identifier" &&
    expression.callee.name === "select" &&
    expression.args[0]?.kind === "literal" &&
    expression.args[0].value === "#";
}

function isFunction(node: Record<string, unknown>): node is Record<string, unknown> & { params: string[]; body: Block } {
  return (node.kind === "function-expr" || node.kind === "function-decl") && Array.isArray(node.params);
}

function reserve(base: string, oldName: string, used: Set<string>): string {
  if (!used.has(base) || base === oldName) {
    used.delete(oldName);
    used.add(base);
    return base;
  }
  let suffix = 2;
  while (used.has(`${base}${suffix}`)) {
    suffix += 1;
  }
  const name = `${base}${suffix}`;
  used.delete(oldName);
  used.add(name);
  return name;
}

function renameInBlock(body: Block, oldName: string, newName: string): void {
  walk(body, (node) => {
    if (isFunction(node) && node.params.includes(oldName)) {
      return false;
    }
    if (node.kind === "identifier" && node.name === oldName) {
      node.name = newName;
    } else if (node.kind === "local" && Array.isArray(node.names)) {
      node.names = node.names.map((name) => name === oldName ? newName : name);
    } else if (node.kind === "numeric-for" && node.name === oldName) {
      node.name = newName;
    } else if (node.kind === "generic-for" && Array.isArray(node.names)) {
      node.names = node.names.map((name) => name === oldName ? newName : name);
    }
    return true;
  });
}

type Visit = (node: Record<string, unknown>) => boolean;

function walk(value: unknown, enter: Visit): void {
  if (Array.isArray(value)) {
    value.forEach((item) => walk(item, enter));
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }
  const node = value as Record<string, unknown>;
  if (enter(node)) {
    for (const child of Object.values(node)) {
      walk(child, enter);
    }
  }
}
