import { analyzeBindings, type LexicalBinding } from "../analysis/Bindings.js";
import { isValidIdentifier } from "../reconstruct/Naming.js";
import type { Block, Chunk, Expression, LocalDeclaration, Statement, TableField } from "./Ast.js";
import { countIdentifier, mapChildExpressions, mapStatementExpressions, rewriteBlocks } from "./AstWalk.js";

export interface TempFoldingOptions {
  /** Bindings explicitly protected by the caller or reconstructor. */
  sourceNames?: ReadonlySet<string>;
  /** Debug spelling fallback for AST nodes without producer ownership. */
  debugNames?: ReadonlySet<string>;
  /** Register-derived spelling fallback for AST nodes without ownership. */
  inferredSourceNames?: ReadonlySet<string>;
  /** Debug and register-derived declaration evidence in each function. */
  declarationNamesByPrototype?: ReadonlyMap<number, ReadonlySet<string>>;
  /** Fold only temporaries passed straight to one of these helpers. The
   * parameters of an inlined helper occupy registers like declared locals;
   * once its call is restored they are argument expressions again. */
  argumentsOf?: ReadonlySet<string>;
}

/** Members of these tables are resolved when the chunk is loaded (GETIMPORT);
 * reading one earlier or later than a neighbouring evaluation is the same. */
const LIBRARIES = new Set([
  "math", "string", "table", "os", "task", "coroutine", "bit32", "utf8", "buffer", "debug", "vector",
  "Enum", "Vector3", "Vector2", "Vector3int16", "Vector2int16", "CFrame", "Color3", "UDim", "UDim2",
  "TweenInfo", "Instance", "Rect", "Ray", "NumberRange", "NumberSequence", "ColorSequence",
  "NumberSequenceKeypoint", "ColorSequenceKeypoint", "BrickColor", "Region3", "Region3int16", "Random",
  "DateTime", "PhysicalProperties", "Font", "OverlapParams", "RaycastParams", "Axes", "Faces",
  "PathWaypoint", "FloatCurveKey", "RotationCurveKey", "CatalogSearchParams", "SharedTable",
]);

/** A folded statement should still read as one line. */
const MAX_FOLDED_WEIGHT = 40;

/**
 * Return single-use temporaries to the expression that consumes them.
 *
 * A temporary directly before its consumer may move into it when everything
 * the consumer evaluates before that read is inert: literals, reads of
 * bindings no closure rewrites, library members and function literals. The
 * initializer then still runs before every operation it ran before, so
 * calls, field reads and metamethods keep their order. Short-circuit arms,
 * conditional arms, loops and function bodies are never folded into.
 */
export function foldTemporaries(ast: Chunk, options: TempFoldingOptions = {}): Chunk {
  const sourceNames = options.sourceNames ?? new Set<string>();
  const sourceDeclared = (declaration: LocalDeclaration, name: string): boolean => {
    // Explicit caller-provided protection always wins. The scoped inventory
    // only refines inferred spelling hints that otherwise apply module-wide.
    if (sourceNames.has(name) || declaration.definition?.debugName !== undefined) return true;
    const names = declaration.definition && options.declarationNamesByPrototype?.get(declaration.definition.prototypeId);
    return names ? names.has(name) : Boolean(options.debugNames?.has(name) || options.inferredSourceNames?.has(name));
  };
  const { bindings, globals } = analyzeBindings(ast.body);
  const byDeclaration = new Map<Statement, LexicalBinding>();
  const byRead = new Map<Expression, LexicalBinding>();
  const assignedGlobals = new Set<string>();
  for (const binding of bindings) {
    if (binding.declaration.kind === "local" && binding.declaration.names.length === 1) {
      byDeclaration.set(binding.declaration, binding);
    }
    for (const read of binding.reads) byRead.set(read.node, binding);
  }
  collectAssignedGlobals(ast.body, globals, assignedGlobals);
  const helperArguments = new Set<Expression>();
  if (options.argumentsOf) {
    const helpers = options.argumentsOf;
    const visit = (expression: Expression): Expression => {
      if (expression.kind === "call" && expression.callee.kind === "identifier" && helpers.has(expression.callee.name)) {
        expression.args.forEach((arg) => helperArguments.add(arg));
      }
      return mapChildExpressions(expression, visit);
    };
    rewriteBlocks(ast.body, (block) => {
      block.statements.forEach((statement) => mapStatementExpressions(statement, visit));
      return block;
    });
  }

  const stableIdentifier = (node: Expression & { kind: "identifier" }): boolean => {
    const binding = byRead.get(node);
    if (!binding) return !assignedGlobals.has(node.name);
    return !(binding.captured && binding.writes.length > 0);
  };

  const foldable = (statement: Statement): { binding: LexicalBinding; value: Expression } | undefined => {
    if (statement.kind !== "local" || statement.names.length !== 1 || statement.values.length !== 1) return undefined;
    const binding = byDeclaration.get(statement);
    const value = statement.values[0]!;
    if (!binding || binding.captured || binding.writes.length > 0 || binding.reads.length !== 1) return undefined;
    if (binding.name === "_") return undefined;
    if (options.argumentsOf ? !helperArguments.has(binding.reads[0]!.node) : sourceDeclared(statement, binding.name)) {
      return undefined;
    }
    if (value.kind === "function-expr") return undefined;
    return { binding, value };
  };

  const isGlobal = (node: Expression): boolean => !byRead.has(node);
  // An absorbed store no longer reads the table through its target.
  const rebind = (previous: Statement, next: Statement, consumed: Expression): void => {
    const binding = byDeclaration.get(previous);
    if (!binding) return;
    binding.reads = binding.reads.filter((read) => read.node !== consumed);
    byDeclaration.set(next, binding);
  };

  const body = rewriteBlocks(ast.body, (block) => {
    let statements = block.statements;
    for (let round = 0; round < 8; round++) {
      const folded = foldRun(statements, foldable, stableIdentifier, isGlobal);
      const absorbed = absorbFieldStores(folded, rebind);
      const changed = absorbed.length !== statements.length;
      statements = absorbed;
      if (!changed) break;
    }
    return statements === block.statements ? block : { ...block, statements };
  });
  return { ...ast, body: options.argumentsOf ? body : propagateLiterals(body, sourceDeclared) };
}

function foldRun(
  statements: Statement[],
  foldable: (statement: Statement) => { binding: LexicalBinding; value: Expression } | undefined,
  stableIdentifier: (node: Expression & { kind: "identifier" }) => boolean,
  isGlobal: (node: Expression) => boolean,
): Statement[] {
  let out = statements;
  for (let index = out.length - 1; index > 0; index--) {
    const candidate = foldable(out[index - 1]!);
    if (!candidate) continue;
    const consumer = out[index]!;
    const read = candidate.binding.reads[0]!.node;
    const site = locate(consumer, read, stableIdentifier, isGlobal);
    if (!site || !site.ordered) continue;
    const value = candidate.value;
    const pack = value.kind === "call" || value.kind === "method-call" || value.kind === "vararg";
    const declaration = out[index - 1]!;
    const returned = consumer.kind === "return" && consumer.values.length === 1 && consumer.values[0] === read;
    // Unknown AST locals keep the existing declaration policy. Additional
    // list-tail motion requires ownership from an actual bytecode producer.
    if (pack && site.tail && !returned && (declaration.kind !== "local" || !declaration.definition)) continue;
    // A local keeps one value. In every list tail, parentheses retain that
    // adjustment, including a zero-result call becoming one explicit nil.
    // A table bound before it is returned is the module or record it names.
    if (value.kind === "table" && consumer.kind === "return") continue;
    if (weight(value) > 3 && site.weight - 1 + weight(value) > MAX_FOLDED_WEIGHT) continue;
    if (out === statements) out = [...statements];
    out[index] = replaceInStatement(consumer, read, pack && site.tail ? { kind: "paren", expression: value } : value);
    out.splice(index - 1, 1);
  }
  return out;
}

interface ReadSite {
  /** Evaluated exactly once, with only inert evaluations before it. */
  ordered: boolean;
  /** Last element of an expression list: a call here keeps all its results. */
  tail: boolean;
  /** Size of the top-level expression that contains the read. */
  weight: number;
}

function locate(
  statement: Statement,
  target: Expression,
  stableIdentifier: (node: Expression & { kind: "identifier" }) => boolean,
  isGlobal: (node: Expression) => boolean,
): ReadSite | undefined {
  let inert = true;
  let conditional = 0;
  let found: ReadSite | undefined;
  let root: Expression | undefined;

  const visit = (expression: Expression, tail: boolean): void => {
    if (found) return;
    if (expression === target) {
      found = { ordered: inert && conditional === 0, tail, weight: root ? weight(root) : 1 };
      return;
    }
    switch (expression.kind) {
      case "identifier":
        if (!stableIdentifier(expression)) inert = false;
        return;
      case "literal":
      case "vararg":
      case "function-expr":
        return;
      case "property":
        if (isLibraryMember(expression, isGlobal)) return;
        visit(expression.object, false);
        inert = false;
        return;
      case "index":
        visit(expression.table, false);
        visit(expression.key, false);
        inert = false;
        return;
      case "unary":
        visit(expression.argument, false);
        if (expression.op !== "not") inert = false;
        return;
      case "binary":
        visit(expression.left, false);
        if (expression.op === "and" || expression.op === "or") {
          conditional += 1;
          visit(expression.right, false);
          conditional -= 1;
          return;
        }
        visit(expression.right, false);
        inert = false;
        return;
      case "call":
        visit(expression.callee, false);
        expression.args.forEach((arg, index) => visit(arg, index === expression.args.length - 1));
        inert = false;
        return;
      case "method-call":
        visit(expression.object, false);
        expression.args.forEach((arg, index) => visit(arg, index === expression.args.length - 1));
        inert = false;
        return;
      case "table":
        expression.fields.forEach((field, index) => {
          if (field.key) visit(field.key, false);
          visit(field.value, index === expression.fields.length - 1 && !field.key && !field.name);
          // A private constructor cannot invoke __newindex, but storing a
          // nil/NaN key can still throw before a later field is evaluated.
          if (field.key && (field.key.kind !== "literal" || field.key.value === null ||
              (typeof field.key.value === "number" && Number.isNaN(field.key.value)))) inert = false;
        });
        return;
      case "paren":
        visit(expression.expression, false);
        return;
      case "if-expr":
        visit(expression.test, false);
        conditional += 1;
        visit(expression.consequent, false);
        for (const branch of expression.branches) {
          visit(branch.test, false);
          visit(branch.value, false);
        }
        visit(expression.alternate, false);
        conditional -= 1;
        return;
      case "interp":
        for (const part of expression.parts) {
          if (part.kind === "expr" && typeof part.value !== "string") visit(part.value, false);
        }
        inert = false;
        return;
    }
  };
  const top = (expression: Expression, tail: boolean): void => {
    if (found) return;
    root = expression;
    visit(expression, tail);
  };
  const list = (values: Expression[]): void => values.forEach((value, index) => top(value, index === values.length - 1));
  const targetOperands = (expression: Expression, reads: boolean): void => {
    if (expression.kind === "property") {
      top(expression.object, false);
      if (reads) inert = false;
    } else if (expression.kind === "index") {
      top(expression.table, false);
      top(expression.key, false);
      if (reads) inert = false;
    }
  };

  switch (statement.kind) {
    case "local":
      list(statement.values);
      break;
    case "assign":
      // Luau evaluates every target's object and key before any value.
      statement.targets.forEach((expression) => targetOperands(expression, false));
      list(statement.values);
      break;
    case "compound-assign":
      targetOperands(statement.target, true);
      top(statement.value, false);
      break;
    case "expression-stmt":
      top(statement.expression, false);
      break;
    case "return":
      list(statement.values);
      break;
    case "if":
      top(statement.test, false);
      break;
    case "numeric-for":
      top(statement.start, false);
      top(statement.stop, false);
      if (statement.step) top(statement.step, false);
      break;
    case "generic-for":
      list(statement.iterators);
      break;
    default:
      break;
  }
  return found;
}

function replaceInStatement(statement: Statement, target: Expression, replacement: Expression): Statement {
  // Untouched subtrees keep their identity: later folds find reads by node.
  const replace = (expression: Expression): Expression =>
    expression === target ? replacement : mapChildExpressions(expression, replace);
  if (statement.kind === "if") return { ...statement, test: replace(statement.test) };
  return mapStatementExpressions(statement, replace);
}

/** `local t = {...}` directly followed by `t.name = value` is one constructor,
 * provided the value cannot observe the unfinished table. */
function absorbFieldStores(
  statements: Statement[],
  rebind: (previous: Statement, next: Statement, consumed: Expression) => void,
): Statement[] {
  const out: Statement[] = [];
  for (const statement of statements) {
    const previous = out.at(-1);
    if (
      previous?.kind === "local" && previous.names.length === 1 && previous.values.length === 1 &&
      previous.values[0]!.kind === "table" &&
      statement.kind === "assign" && statement.targets.length === 1 && statement.values.length === 1
    ) {
      const name = previous.names[0]!;
      const table = previous.values[0]!;
      const target = statement.targets[0]!;
      const value = statement.values[0]!;
      const receiver = target.kind === "property" ? target.object : target.kind === "index" ? target.table : undefined;
      const field = receiver?.kind !== "identifier" || receiver.name !== name ? undefined
        : target.kind === "property" ? target.name
        : target.kind === "index" && target.key.kind === "literal" && typeof target.key.value === "string" &&
          isValidIdentifier(target.key.value) && table.templateKeys?.[0] === target.key.value ? target.key.value : undefined;
      const reserved = table.templateKeys?.[0];
      const slot = table.fields[0];
      const replacesReservation = reserved === field && table.fields.length === 1 && slot !== undefined && slot.name === field &&
        slot.value.kind === "literal" && slot.value.value === 0;
      if (
        field !== undefined && !field.startsWith("__") && value.kind !== "function-expr" &&
        (target.kind !== "index" || !containsFunctionLiteral(value)) &&
        countIdentifier(value, name) === 0 &&
        // A reserved one-node template can regain precisely that field, not
        // a larger constructor with a different hash layout. Unknown indexed
        // stores retain their original bracket/statement form.
        (!table.templateKeys || ((table.fields.length === 0 || replacesReservation) && reserved === field)) &&
        table.fields.every((existing) => !existing.list && !existing.key && existing.name !== undefined &&
          (existing.name !== field || replacesReservation))
      ) {
        const fields: TableField[] = [...(replacesReservation ? [] : table.fields), { name: field, value }];
        const merged: Statement = { ...previous, values: [{ ...table, fields }] };
        rebind(previous, merged, receiver!);
        out[out.length - 1] = merged;
        continue;
      }
    }
    out.push(statement);
  }
  return out.length === statements.length ? statements : out;
}

function containsFunctionLiteral(expression: Expression): boolean {
  if (expression.kind === "function-expr") return true;
  let found = false;
  mapChildExpressions(expression, child => {
    found ||= containsFunctionLiteral(child);
    return child;
  });
  return found;
}

/** A literal held by a never-written, uncaptured local with one reader is
 * that literal wherever it is read. */
function propagateLiterals(body: Block, sourceDeclared: (declaration: LocalDeclaration, name: string) => boolean): Block {
  const { bindings } = analyzeBindings(body);
  const replacements = new Map<Expression, Expression>();
  const removed = new Set<Statement>();
  const byRead = new Map<Expression, LexicalBinding>();
  const declarations = new Map<string, number>();
  for (const binding of bindings) {
    for (const read of binding.reads) byRead.set(read.node, binding);
    declarations.set(binding.name, (declarations.get(binding.name) ?? 0) + 1);
  }
  // A unique name cannot be shadowed between the copy and its readers.
  const uniqueName = (binding: LexicalBinding): boolean => declarations.get(binding.name) === 1;
  // A literal local may fold into a closure and let Luau share it; a copy
  // of one is what keeps such a capture a runtime value.
  const isConstantInitializer = (binding: LexicalBinding): boolean => {
    const declaration = binding.declaration;
    if (declaration.kind !== "local") return true;
    const initializer = declaration.values[binding.declarationIndex ?? 0];
    return declaration.values.length !== declaration.names.length || !initializer || initializer.kind === "literal";
  };
  for (const binding of bindings) {
    const declaration = binding.declaration;
    if (declaration.kind !== "local" || declaration.names.length !== 1 || declaration.values.length !== 1) continue;
    const value = declaration.values[0]!;
    if (sourceDeclared(declaration, binding.name) || binding.name === "_") continue;
    if (binding.reads.length === 0 && binding.writes.length === 0 && byRead.has(value)) {
      // A copy of another local that nothing reads has no effect at all.
      removed.add(declaration);
      continue;
    }
    const source = byRead.get(value);
    if (source && binding.writes.length === 0 && source.writes.length === 0 && uniqueName(source) &&
        source.declaration.kind === "local" && !isConstantInitializer(source)) {
      // Neither binding is ever assigned again: the copy is the original.
      for (const read of binding.reads) replacements.set(read.node, { kind: "identifier", name: source.name });
      removed.add(declaration);
      continue;
    }
    if (value.kind !== "literal" || value.value === null) continue;
    if (binding.captured || binding.writes.length > 0 || binding.reads.length !== 1) continue;
    replacements.set(binding.reads[0]!.node, value);
    removed.add(declaration);
  }
  if (replacements.size === 0 && removed.size === 0) return body;
  const replace = (expression: Expression): Expression => {
    const literal = replacements.get(expression);
    if (literal) return literal;
    const mapped = mapChildExpressions(expression, replace);
    return mapped.kind === "function-expr" ? { ...mapped, body: block(mapped.body) } : mapped;
  };
  const block = (value: Block): Block => ({
    ...value,
    statements: value.statements.filter((statement) => !removed.has(statement)).map((statement) => {
      const mapped = mapStatementExpressions(statement, replace);
      switch (mapped.kind) {
        case "function-decl": case "while": case "repeat": case "numeric-for": case "generic-for": case "do":
          return { ...mapped, body: block(mapped.body) };
        case "if":
          return {
            ...mapped,
            consequent: block(mapped.consequent),
            branches: mapped.branches.map((branch) => ({ ...branch, body: block(branch.body) })),
            ...(mapped.alternate ? { alternate: block(mapped.alternate) } : {}),
          };
        default:
          return mapped;
      }
    }),
  });
  return block(body);
}

function collectAssignedGlobals(body: Block, globals: ReadonlySet<string>, out: Set<string>): void {
  rewriteBlocks(body, (block) => {
    for (const statement of block.statements) {
      if (statement.kind === "assign") {
        for (const target of statement.targets) {
          if (target.kind === "identifier" && globals.has(target.name)) out.add(target.name);
        }
      }
      if (statement.kind === "function-decl" && !statement.local && !/[.:]/.test(statement.name) && globals.has(statement.name)) {
        out.add(statement.name);
      }
    }
    return block;
  });
}

function isLibraryMember(expression: Expression, isGlobal: (node: Expression) => boolean): boolean {
  let depth = 0;
  let node: Expression = expression;
  while (node.kind === "property") {
    node = node.object;
    depth += 1;
  }
  return depth > 0 && depth <= 2 && node.kind === "identifier" && LIBRARIES.has(node.name) && isGlobal(node);
}


function weight(expression: Expression): number {
  let total = 1;
  if (expression.kind === "function-expr") return 12;
  mapChildExpressions(expression, (child) => {
    total += weight(child);
    return child;
  });
  return total;
}
