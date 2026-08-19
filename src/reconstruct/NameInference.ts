import type { Block, Chunk, Expression, Statement } from "../ast/Ast.js";
import { NameAllocator, isValidIdentifier } from "./Naming.js";

const GENERATED = /^(?:value|result|config|index|key|item|entry|state|data|count|tmp|player|function_?)(\d*)$/;
const MAKE_STEM = /^(?:make|create|build|get)([A-Z][A-Za-z0-9]*)$/;

export function inferHumanNames(ast: Chunk): Chunk {
  const inlined = { kind: "chunk" as const, body: inlineOwnedTables(ast.body) };
  return renameChunk(inlined);
}

export function repairUndeclaredAutoLocals(ast: Chunk): Chunk {
  return { kind: "chunk", body: repairBlock(ast.body, [new Set()]) };
}

export function isGeneratedName(name: string): boolean {
  return GENERATED.test(name);
}

function repairBlock(body: Block, scopes: Array<Set<string>>): Block {
  return { kind: "block", statements: body.statements.map((statement) => repairStatement(statement, scopes)) };
}

function declared(name: string, scopes: Array<Set<string>>): boolean {
  return scopes.some((scope) => scope.has(name));
}

function declareName(name: string, scopes: Array<Set<string>>): void {
  scopes[scopes.length - 1]?.add(name);
}

function repairStatement(statement: Statement, scopes: Array<Set<string>>): Statement {
  switch (statement.kind) {
    case "local":
      statement.names.forEach((name) => declareName(name, scopes));
      return statement;
    case "assign": {
      if (
        statement.targets.length === 1 &&
        statement.values.length === 1 &&
        statement.targets[0]?.kind === "identifier"
      ) {
        const name = statement.targets[0].name;
        if (isGeneratedName(name) && !declared(name, scopes)) {
          declareName(name, scopes);
          return { kind: "local", names: [name], values: statement.values };
        }
      }
      for (const target of statement.targets) {
        if (target.kind === "identifier") {
          declareName(target.name, scopes);
        }
      }
      return statement;
    }
    case "function-decl": {
      if (statement.local) {
        declareName(statement.name, scopes);
      }
      return { ...statement, body: repairBlock(statement.body, [...scopes, new Set(statement.params)]) };
    }
    case "if":
      return {
        ...statement,
        consequent: repairBlock(statement.consequent, [...scopes, new Set()]),
        branches: statement.branches.map((branch) => ({ ...branch, body: repairBlock(branch.body, [...scopes, new Set()]) })),
        alternate: statement.alternate ? repairBlock(statement.alternate, [...scopes, new Set()]) : undefined,
      };
    case "while":
    case "repeat":
    case "do":
      return { ...statement, body: repairBlock(statement.body, [...scopes, new Set()]) };
    case "numeric-for":
      return { ...statement, body: repairBlock(statement.body, [...scopes, new Set([statement.name])]) };
    case "generic-for":
      return { ...statement, body: repairBlock(statement.body, [...scopes, new Set(statement.names)]) };
    default:
      return statement;
  }
}

function inlineOwnedTables(body: Block): Block {
  return { kind: "block", statements: inlineStatements(body.statements.map(mapNestedInline)) };
}

function mapNestedInline(statement: Statement): Statement {
  switch (statement.kind) {
    case "function-decl":
      return { ...statement, body: inlineOwnedTables(statement.body) };
    case "if":
      return {
        ...statement,
        consequent: inlineOwnedTables(statement.consequent),
        branches: statement.branches.map((branch) => ({ ...branch, body: inlineOwnedTables(branch.body) })),
        alternate: statement.alternate ? inlineOwnedTables(statement.alternate) : undefined,
      };
    case "while":
    case "repeat":
    case "do":
    case "numeric-for":
    case "generic-for":
      return { ...statement, body: inlineOwnedTables(statement.body) };
    default:
      return statement;
  }
}

function inlineStatements(statements: Statement[]): Statement[] {
  const tables = new Map<string, { index: number; table: Expression }>();
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i]!;
    if (
      statement.kind === "local" &&
      statement.names.length === 1 &&
      statement.values.length === 1 &&
      statement.values[0]?.kind === "table" &&
      isGeneratedName(statement.names[0]!)
    ) {
      tables.set(statement.names[0]!, { index: i, table: statement.values[0] });
    }
  }
  const drop = new Set<number>();
  const replacements = new Map<string, Expression>();
  const ordered = [...tables.entries()].sort((left, right) => right[1].index - left[1].index);
  for (const [name, record] of ordered) {
    const uses = countUses(statements, name, record.index);
    if (uses.reads === 1 && uses.writes === 0 && !uses.unsafe) {
      replacements.set(name, substExpr(record.table, replacements));
      drop.add(record.index);
    }
  }
  if (replacements.size === 0) {
    return statements;
  }
  return statements.flatMap((statement, index) => (drop.has(index) ? [] : [replaceIdents(statement, replacements)]));
}

function substExpr(expression: Expression, replacements: Map<string, Expression>, seen = new Set<string>()): Expression {
  if (expression.kind === "identifier") {
    const next = replacements.get(expression.name);
    if (next && !seen.has(expression.name)) {
      const nested = new Set(seen);
      nested.add(expression.name);
      return substExpr(next, replacements, nested);
    }
    return expression;
  }
  if (expression.kind === "table") {
    return {
      ...expression,
      fields: expression.fields.map((field) => ({
        ...field,
        key: field.key ? substExpr(field.key, replacements, seen) : undefined,
        value: substExpr(field.value, replacements, seen),
      })),
    };
  }
  return expression;
}

function countUses(statements: Statement[], name: string, after: number): { reads: number; writes: number; unsafe: boolean } {
  let reads = 0;
  let writes = 0;
  let unsafe = false;
  const visitExpr = (expression: Expression): void => {
    switch (expression.kind) {
      case "identifier":
        if (expression.name === name) {
          reads += 1;
        }
        break;
      case "unary":
        visitExpr(expression.argument);
        break;
      case "binary":
        visitExpr(expression.left);
        visitExpr(expression.right);
        break;
      case "call":
        visitExpr(expression.callee);
        expression.args.forEach(visitExpr);
        break;
      case "method-call":
        if (expression.object.kind === "identifier" && expression.object.name === name) {
          unsafe = true;
        }
        visitExpr(expression.object);
        expression.args.forEach(visitExpr);
        break;
      case "index":
      case "property":
        if (
          (expression.kind === "index" ? expression.table : expression.object).kind === "identifier" &&
          (expression.kind === "index" ? expression.table : expression.object).kind === "identifier" &&
          ((expression.kind === "index" ? expression.table : expression.object) as { name: string }).name === name
        ) {
          unsafe = true;
        }
        if (expression.kind === "index") {
          visitExpr(expression.table);
          visitExpr(expression.key);
        } else {
          visitExpr(expression.object);
        }
        break;
      case "table":
        expression.fields.forEach((field) => {
          if (field.key) {
            visitExpr(field.key);
          }
          visitExpr(field.value);
        });
        break;
      case "function-expr":
        expression.body.statements.forEach(visitStmt);
        break;
      case "paren":
        visitExpr(expression.expression);
        break;
      case "if-expr":
        visitExpr(expression.test);
        visitExpr(expression.consequent);
        expression.branches.forEach((branch) => {
          visitExpr(branch.test);
          visitExpr(branch.value);
        });
        visitExpr(expression.alternate);
        break;
      default:
        break;
    }
  };
  const visitStmt = (item: Statement): void => {
    switch (item.kind) {
      case "local":
        item.values.forEach(visitExpr);
        break;
      case "assign":
        item.targets.forEach((target) => {
          if (target.kind === "identifier" && target.name === name) {
            writes += 1;
          } else {
            visitExpr(target);
          }
        });
        item.values.forEach(visitExpr);
        break;
      case "compound-assign":
        if (item.target.kind === "identifier" && item.target.name === name) {
          writes += 1;
        } else {
          visitExpr(item.target);
        }
        visitExpr(item.value);
        break;
      case "expression-stmt":
        visitExpr(item.expression);
        break;
      case "return":
        item.values.forEach(visitExpr);
        break;
      case "if":
        visitExpr(item.test);
        item.consequent.statements.forEach(visitStmt);
        item.branches.forEach((branch) => {
          visitExpr(branch.test);
          branch.body.statements.forEach(visitStmt);
        });
        item.alternate?.statements.forEach(visitStmt);
        break;
      case "while":
        visitExpr(item.test);
        item.body.statements.forEach(visitStmt);
        break;
      case "repeat":
        item.body.statements.forEach(visitStmt);
        visitExpr(item.test);
        break;
      case "numeric-for":
        visitExpr(item.start);
        visitExpr(item.stop);
        item.step && visitExpr(item.step);
        item.body.statements.forEach(visitStmt);
        break;
      case "generic-for":
        item.iterators.forEach(visitExpr);
        item.body.statements.forEach(visitStmt);
        break;
      case "function-decl":
        item.body.statements.forEach(visitStmt);
        break;
      case "do":
        item.body.statements.forEach(visitStmt);
        break;
      default:
        break;
    }
  };
  for (let i = after + 1; i < statements.length; i++) {
    visitStmt(statements[i]!);
  }
  return { reads, writes, unsafe };
}

function replaceIdents(statement: Statement, replacements: Map<string, Expression>): Statement {
  const swap = (expression: Expression): Expression => {
    if (expression.kind === "identifier") {
      return substExpr(expression, replacements);
    }
    if (expression.kind === "unary") {
      return { ...expression, argument: swap(expression.argument) };
    }
    if (expression.kind === "binary") {
      return { ...expression, left: swap(expression.left), right: swap(expression.right) };
    }
    if (expression.kind === "call") {
      return { ...expression, callee: swap(expression.callee), args: expression.args.map(swap) };
    }
    if (expression.kind === "method-call") {
      return { ...expression, object: swap(expression.object), args: expression.args.map(swap) };
    }
    if (expression.kind === "index") {
      return { ...expression, table: swap(expression.table), key: swap(expression.key) };
    }
    if (expression.kind === "property") {
      return { ...expression, object: swap(expression.object) };
    }
    if (expression.kind === "table") {
      return {
        ...expression,
        fields: expression.fields.map((field) => ({
          ...field,
          key: field.key ? swap(field.key) : undefined,
          value: swap(field.value),
        })),
      };
    }
    if (expression.kind === "paren") {
      return { ...expression, expression: swap(expression.expression) };
    }
    if (expression.kind === "if-expr") {
      return {
        ...expression,
        test: swap(expression.test),
        consequent: swap(expression.consequent),
        branches: expression.branches.map((branch) => ({ test: swap(branch.test), value: swap(branch.value) })),
        alternate: swap(expression.alternate),
      };
    }
    return expression;
  };
  switch (statement.kind) {
    case "local":
      return { ...statement, values: statement.values.map(swap) };
    case "assign":
      return { ...statement, targets: statement.targets.map(swap), values: statement.values.map(swap) };
    case "compound-assign":
      return { ...statement, target: swap(statement.target), value: swap(statement.value) };
    case "expression-stmt":
      return { ...statement, expression: swap(statement.expression) };
    case "return":
      return { ...statement, values: statement.values.map(swap) };
    case "if":
      return {
        ...statement,
        test: swap(statement.test),
        consequent: { kind: "block", statements: statement.consequent.statements.map((item) => replaceIdents(item, replacements)) },
        branches: statement.branches.map((branch) => ({
          test: swap(branch.test),
          body: { kind: "block", statements: branch.body.statements.map((item) => replaceIdents(item, replacements)) },
        })),
        alternate: statement.alternate
          ? { kind: "block", statements: statement.alternate.statements.map((item) => replaceIdents(item, replacements)) }
          : undefined,
      };
    case "function-decl":
      return { ...statement, body: { kind: "block", statements: statement.body.statements.map((item) => replaceIdents(item, replacements)) } };
    default:
      return statement;
  }
}

interface Binding {
  id: number;
  name: string;
  kind: "local" | "param" | "loop";
  depth: number;
  hint?: string;
  compoundAdds: number;
  compoundSubs: number;
  assignedNot: boolean;
  returned: boolean;
  captured: boolean;
  whileCountdown: boolean;
  repeatCount: boolean;
  exportField?: string;
  classTable: boolean;
  forNest: number;
  ipairs: boolean;
}

function renameChunk(ast: Chunk): Chunk {
  const bindings: Binding[] = [];
  collect(ast.body.statements, bindings, [new Map()], 0, 0);
  applyHints(ast.body.statements, bindings);
  const names = allocate(bindings);
  const state = { next: 0 };
  return { kind: "chunk", body: applyBlock(ast.body, names, [new Map()], state) };
}

function collect(
  statements: Statement[],
  bindings: Binding[],
  scopes: Array<Map<string, Binding>>,
  depth: number,
  forNest: number,
): void {
  const declare = (name: string, kind: Binding["kind"], extra: Partial<Binding> = {}): Binding => {
    const binding: Binding = {
      id: bindings.length,
      name,
      kind,
      depth,
      compoundAdds: 0,
      compoundSubs: 0,
      assignedNot: false,
      returned: false,
      captured: false,
      whileCountdown: false,
      repeatCount: false,
      classTable: false,
      forNest,
      ipairs: false,
      ...extra,
    };
    bindings.push(binding);
    scopes[scopes.length - 1]!.set(name, binding);
    return binding;
  };
  const resolve = (name: string): Binding | undefined => {
    for (let i = scopes.length - 1; i >= 0; i--) {
      const found = scopes[i]!.get(name);
      if (found) {
        if (found.depth < depth) {
          found.captured = true;
        }
        return found;
      }
    }
    return undefined;
  };
  const visitExpr = (expression: Expression): void => {
    switch (expression.kind) {
      case "identifier":
        resolve(expression.name);
        break;
      case "unary":
        visitExpr(expression.argument);
        break;
      case "binary":
        visitExpr(expression.left);
        visitExpr(expression.right);
        break;
      case "call":
        visitExpr(expression.callee);
        expression.args.forEach(visitExpr);
        break;
      case "method-call":
        visitExpr(expression.object);
        expression.args.forEach(visitExpr);
        break;
      case "index":
        visitExpr(expression.table);
        visitExpr(expression.key);
        break;
      case "property":
        visitExpr(expression.object);
        break;
      case "table":
        expression.fields.forEach((field) => {
          if (field.key) {
            visitExpr(field.key);
          }
          visitExpr(field.value);
          if (field.name && field.value.kind === "identifier" && !field.name.startsWith("_")) {
            const exported = resolve(field.value.name);
            if (exported && !exported.exportField) {
              exported.exportField = field.name;
            }
          }
        });
        break;
      case "function-expr":
        scopes.push(new Map());
        expression.params.forEach((param) => declare(param, "param"));
        collect(expression.body.statements, bindings, scopes, depth + 1, 0);
        scopes.pop();
        break;
      case "paren":
        visitExpr(expression.expression);
        break;
      case "if-expr":
        visitExpr(expression.test);
        visitExpr(expression.consequent);
        expression.branches.forEach((branch) => {
          visitExpr(branch.test);
          visitExpr(branch.value);
        });
        visitExpr(expression.alternate);
        break;
      default:
        break;
    }
  };

  for (const statement of statements) {
    switch (statement.kind) {
      case "local":
        statement.values.forEach(visitExpr);
        statement.names.forEach((name, index) => {
          const init = statement.values[index] ?? (statement.values.length === 1 ? statement.values[0] : undefined);
          declare(name, "local", { hint: hintFromInit(init) });
        });
        break;
      case "assign":
        statement.values.forEach(visitExpr);
        statement.targets.forEach((target, index) => {
          if (target.kind === "identifier") {
            const binding = resolve(target.name);
            const value = statement.values[index] ?? statement.values[0];
            if (binding && !binding.hint) {
              binding.hint = hintFromInit(value);
            }
            if (binding && value?.kind === "unary" && value.op === "not") {
              binding.assignedNot = true;
            }
          } else if (
            target.kind === "property" &&
            target.object.kind === "identifier" &&
            statement.values[index]?.kind === "identifier"
          ) {
            const exported = resolve(statement.values[index]!.name);
            if (exported && !target.name.startsWith("_")) {
              exported.exportField = target.name;
            }
            visitExpr(target);
          } else {
            visitExpr(target);
          }
        });
        break;
      case "compound-assign":
        visitExpr(statement.value);
        if (statement.target.kind === "identifier") {
          const binding = resolve(statement.target.name);
          if (binding) {
            if (statement.op === "+") {
              binding.compoundAdds += 1;
            }
            if (statement.op === "-") {
              binding.compoundSubs += 1;
            }
          }
        } else {
          visitExpr(statement.target);
        }
        break;
      case "function-decl": {
        if (statement.local) {
          declare(statement.name, "local");
        } else {
          const owner = resolve(statement.name.split(/[.:]/)[0] ?? "");
          if (owner) {
            owner.classTable = true;
          }
        }
        if (declarationTail(statement.name) === "rgb" && statement.params.length === 3) {
          scopes.push(new Map());
          ["r", "g", "b"].forEach((hint, index) => declare(statement.params[index]!, "param", { hint }));
          collect(statement.body.statements, bindings, scopes, depth + 1, 0);
          scopes.pop();
          break;
        }
        scopes.push(new Map());
        statement.params.forEach((param) => declare(param, "param"));
        collect(statement.body.statements, bindings, scopes, depth + 1, 0);
        scopes.pop();
        break;
      }
      case "if":
        visitExpr(statement.test);
        scopes.push(new Map());
        collect(statement.consequent.statements, bindings, scopes, depth, forNest);
        scopes.pop();
        for (const branch of statement.branches) {
          visitExpr(branch.test);
          scopes.push(new Map());
          collect(branch.body.statements, bindings, scopes, depth, forNest);
          scopes.pop();
        }
        if (statement.alternate) {
          scopes.push(new Map());
          collect(statement.alternate.statements, bindings, scopes, depth, forNest);
          scopes.pop();
        }
        break;
      case "while":
        visitExpr(statement.test);
        if (statement.test.kind === "binary" && (statement.test.op === ">" || statement.test.op === ">=") && statement.test.left.kind === "identifier") {
          const binding = resolve(statement.test.left.name);
          if (binding) {
            binding.whileCountdown = true;
          }
        }
        scopes.push(new Map());
        collect(statement.body.statements, bindings, scopes, depth, forNest);
        scopes.pop();
        break;
      case "repeat":
        scopes.push(new Map());
        collect(statement.body.statements, bindings, scopes, depth, forNest);
        scopes.pop();
        if (statement.test.kind === "binary" && statement.test.left.kind === "identifier") {
          const binding = resolve(statement.test.left.name);
          if (binding) {
            binding.repeatCount = true;
          }
        }
        visitExpr(statement.test);
        break;
      case "numeric-for":
        visitExpr(statement.start);
        visitExpr(statement.stop);
        if (statement.step) {
          visitExpr(statement.step);
        }
        scopes.push(new Map());
        declare(statement.name, "loop", {
          hint: /\d$/.test(statement.name) ? (["i", "j", "k"][forNest] ?? "index") : undefined,
          forNest,
        });
        collect(statement.body.statements, bindings, scopes, depth, forNest + 1);
        scopes.pop();
        break;
      case "generic-for": {
        statement.iterators.forEach(visitExpr);
        const ipairs = statement.iterators[0]?.kind === "identifier" && statement.iterators[0].name === "ipairs";
        scopes.push(new Map());
        statement.names.forEach((name, index) => {
          const hint = ipairs ? (index === 0 ? "index" : "value") : undefined;
          declare(name, "loop", { hint, ipairs, forNest });
        });
        collect(statement.body.statements, bindings, scopes, depth, forNest);
        scopes.pop();
        break;
      }
      case "return":
        statement.values.forEach((value) => {
          visitExpr(value);
          if (value.kind === "identifier") {
            const binding = resolve(value.name);
            if (binding) {
              binding.returned = true;
            }
          }
        });
        break;
      case "expression-stmt":
        visitExpr(statement.expression);
        break;
      case "do":
        scopes.push(new Map());
        collect(statement.body.statements, bindings, scopes, depth, forNest);
        scopes.pop();
        break;
      default:
        break;
    }
  }
}

function applyHints(statements: Statement[], bindings: Binding[]): void {
  const byName = new Map<string, Binding[]>();
  for (const binding of bindings) {
    const list = byName.get(binding.name) ?? [];
    list.push(binding);
    byName.set(binding.name, list);
  }
  for (const statement of statements) {
    if (
      statement.kind === "local" &&
      statement.values.length === 1 &&
      statement.values[0]?.kind === "call" &&
      statement.values[0].callee.kind === "identifier"
    ) {
      const stem = calleeStem(statement.values[0].callee.name);
      if (stem && statement.names[0]) {
        const candidates = byName.get(statement.names[0]) ?? [];
        const binding = candidates.find((item) => !item.hint && isGeneratedName(item.name));
        if (binding) {
          binding.hint = stem;
        }
      }
      if (statement.names[1] && statement.values[0].callee.name === "makeAccumulator") {
        const candidates = byName.get(statement.names[1]) ?? [];
        const binding = candidates.find((item) => isGeneratedName(item.name));
        if (binding) {
          binding.hint = "stats";
        }
      }
    }
    if (statement.kind === "function-decl") {
      applyHints(statement.body.statements, bindings);
    }
  }
}

function hintFromInit(init: Expression | undefined): string | undefined {
  if (!init) {
    return undefined;
  }
  if (init.kind === "property" && isValidIdentifier(init.name)) {
    if (init.name === "LocalPlayer") {
      return "LocalPlayer";
    }
    if (init.name[0] && init.name[0] === init.name[0].toUpperCase()) {
      return init.name;
    }
  }
  if (init.kind === "method-call") {
    if ((init.name === "GetService" || init.name === "WaitForChild") && init.args[0]?.kind === "literal" && typeof init.args[0].value === "string") {
      return isValidIdentifier(init.args[0].value) ? init.args[0].value : undefined;
    }
    if (init.name === "new" && init.object.kind === "identifier") {
      return lowerFirst(init.object.name);
    }
  }
  if (init.kind === "call") {
    if (init.callee.kind === "identifier") {
      return calleeStem(init.callee.name);
    }
    if (init.callee.kind === "property" && init.callee.name === "new" && init.callee.object.kind === "identifier") {
      return lowerFirst(init.callee.object.name);
    }
  }
  if (
    init.kind === "if-expr" &&
    init.consequent.kind === "call" &&
    init.consequent.callee.kind === "identifier" &&
    init.consequent.callee.name === "require"
  ) {
    return "OptionalDependency";
  }
  return undefined;
}

function calleeStem(name: string): string | undefined {
  const match = MAKE_STEM.exec(name);
  return match ? lowerFirst(match[1]!) : undefined;
}

function lowerFirst(name: string): string {
  return name.length === 0 ? name : name[0]!.toLowerCase() + name.slice(1);
}

function declarationTail(name: string): string {
  return name.split(/[.:]/).at(-1) ?? name;
}

function allocate(bindings: Binding[]): Map<number, string> {
  const names = new Map<number, string>();
  const depths = [...new Set(bindings.map((binding) => binding.depth))].sort((a, b) => a - b);
  for (const depth of depths) {
    const allocator = new NameAllocator();
    for (const binding of bindings) {
      if (binding.depth <= depth && !isGeneratedName(binding.name)) {
        allocator.take(binding.name);
      }
    }
    for (const binding of bindings.filter((item) => item.depth === depth)) {
      if (!isGeneratedName(binding.name)) {
        names.set(binding.id, binding.name);
        continue;
      }
      const hint = pickHint(binding);
      names.set(binding.id, hint && isValidIdentifier(hint) ? allocator.take(hint) : binding.name);
    }
  }
  return names;
}

function pickHint(binding: Binding): string | undefined {
  if (binding.hint) {
    return binding.hint;
  }
  if (binding.exportField && isValidIdentifier(binding.exportField)) {
    return binding.exportField === "Config" ? "CONFIG" : binding.exportField;
  }
  if (binding.whileCountdown && binding.compoundSubs > 0) {
    return "descending";
  }
  if (binding.repeatCount && binding.compoundAdds > 0) {
    return "repeatCount";
  }
  if (binding.kind === "local" && binding.depth === 0 && binding.captured && binding.compoundAdds > 0) {
    return "sharedCounter";
  }
  if (binding.kind === "local" && binding.depth === 0 && binding.captured && binding.assignedNot) {
    return "sharedFlag";
  }
  if (binding.kind === "local" && binding.compoundAdds > 0 && binding.returned) {
    return "total";
  }
  return undefined;
}

interface Cursor {
  next: number;
}

function applyBlock(body: Block, names: Map<number, string>, scopes: Array<Map<string, number>>, cursor: Cursor): Block {
  return { kind: "block", statements: body.statements.map((statement) => applyStmt(statement, names, scopes, cursor)) };
}

function applyStmt(statement: Statement, names: Map<number, string>, scopes: Array<Map<string, number>>, cursor: Cursor): Statement {
  const resolve = (name: string): string => {
    for (let i = scopes.length - 1; i >= 0; i--) {
      const id = scopes[i]!.get(name);
      if (id !== undefined) {
        return names.get(id) ?? name;
      }
    }
    return name;
  };
  const bind = (old: string): string => {
    const id = cursor.next++;
    scopes[scopes.length - 1]!.set(old, id);
    return names.get(id) ?? old;
  };
  const expr = (expression: Expression): Expression => applyExpr(expression, names, scopes, cursor);

  switch (statement.kind) {
    case "local":
      return { ...statement, values: statement.values.map(expr), names: statement.names.map(bind) };
    case "assign":
      return { ...statement, values: statement.values.map(expr), targets: statement.targets.map(expr) };
    case "compound-assign":
      return { ...statement, target: expr(statement.target), value: expr(statement.value) };
    case "function-decl": {
      const name = statement.local ? bind(statement.name) : renameDecl(statement.name, resolve);
      scopes.push(new Map());
      const params = statement.params.map(bind);
      const body = applyBlock(statement.body, names, scopes, cursor);
      scopes.pop();
      return { ...statement, name, params, body };
    }
    case "if":
      return {
        ...statement,
        test: expr(statement.test),
        consequent: push(statement.consequent, names, scopes, cursor),
        branches: statement.branches.map((branch) => ({ test: expr(branch.test), body: push(branch.body, names, scopes, cursor) })),
        alternate: statement.alternate ? push(statement.alternate, names, scopes, cursor) : undefined,
      };
    case "while":
      return { ...statement, test: expr(statement.test), body: push(statement.body, names, scopes, cursor) };
    case "repeat":
      return { ...statement, body: push(statement.body, names, scopes, cursor), test: expr(statement.test) };
    case "numeric-for": {
      const start = expr(statement.start);
      const stop = expr(statement.stop);
      const step = statement.step ? expr(statement.step) : undefined;
      scopes.push(new Map());
      const loopName = bind(statement.name);
      const body = applyBlock(statement.body, names, scopes, cursor);
      scopes.pop();
      return { ...statement, name: loopName, start, stop, step, body };
    }
    case "generic-for": {
      const iterators = statement.iterators.map(expr);
      scopes.push(new Map());
      const loopNames = statement.names.map(bind);
      const body = applyBlock(statement.body, names, scopes, cursor);
      scopes.pop();
      return { ...statement, names: loopNames, iterators, body };
    }
    case "return":
      return { ...statement, values: statement.values.map(expr) };
    case "expression-stmt":
      return { ...statement, expression: expr(statement.expression) };
    case "do":
      return { ...statement, body: push(statement.body, names, scopes, cursor) };
    default:
      return statement;
  }
}

function push(body: Block, names: Map<number, string>, scopes: Array<Map<string, number>>, cursor: Cursor): Block {
  scopes.push(new Map());
  const next = applyBlock(body, names, scopes, cursor);
  scopes.pop();
  return next;
}

function renameDecl(name: string, resolve: (name: string) => string): string {
  return name
    .split(".")
    .map((part) => {
      const [head, ...rest] = part.split(":");
      return [resolve(head ?? ""), ...rest].join(":");
    })
    .join(".");
}

function applyExpr(expression: Expression, names: Map<number, string>, scopes: Array<Map<string, number>>, cursor: Cursor): Expression {
  const resolve = (name: string): string => {
    for (let i = scopes.length - 1; i >= 0; i--) {
      const id = scopes[i]!.get(name);
      if (id !== undefined) {
        return names.get(id) ?? name;
      }
    }
    return name;
  };
  switch (expression.kind) {
    case "identifier":
      return { ...expression, name: resolve(expression.name) };
    case "unary":
      return { ...expression, argument: applyExpr(expression.argument, names, scopes, cursor) };
    case "binary":
      return {
        ...expression,
        left: applyExpr(expression.left, names, scopes, cursor),
        right: applyExpr(expression.right, names, scopes, cursor),
      };
    case "call":
      return {
        ...expression,
        callee: applyExpr(expression.callee, names, scopes, cursor),
        args: expression.args.map((arg) => applyExpr(arg, names, scopes, cursor)),
      };
    case "method-call":
      return {
        ...expression,
        object: applyExpr(expression.object, names, scopes, cursor),
        args: expression.args.map((arg) => applyExpr(arg, names, scopes, cursor)),
      };
    case "index":
      return {
        ...expression,
        table: applyExpr(expression.table, names, scopes, cursor),
        key: applyExpr(expression.key, names, scopes, cursor),
      };
    case "property":
      return { ...expression, object: applyExpr(expression.object, names, scopes, cursor) };
    case "table":
      return {
        ...expression,
        fields: expression.fields.map((field) => ({
          ...field,
          key: field.key ? applyExpr(field.key, names, scopes, cursor) : undefined,
          value: applyExpr(field.value, names, scopes, cursor),
        })),
      };
    case "function-expr": {
      scopes.push(new Map());
      const params = expression.params.map((param) => {
        const id = cursor.next++;
        scopes[scopes.length - 1]!.set(param, id);
        return names.get(id) ?? param;
      });
      const body = applyBlock(expression.body, names, scopes, cursor);
      scopes.pop();
      return { ...expression, params, body };
    }
    case "paren":
      return { ...expression, expression: applyExpr(expression.expression, names, scopes, cursor) };
    case "if-expr":
      return {
        ...expression,
        test: applyExpr(expression.test, names, scopes, cursor),
        consequent: applyExpr(expression.consequent, names, scopes, cursor),
        branches: expression.branches.map((branch) => ({
          test: applyExpr(branch.test, names, scopes, cursor),
          value: applyExpr(branch.value, names, scopes, cursor),
        })),
        alternate: applyExpr(expression.alternate, names, scopes, cursor),
      };
    case "interp":
      return {
        ...expression,
        parts: expression.parts.map((part) =>
          part.kind === "expr" && typeof part.value !== "string"
            ? { kind: "expr" as const, value: applyExpr(part.value, names, scopes, cursor) }
            : part,
        ),
      };
    default:
      return expression;
  }
}
