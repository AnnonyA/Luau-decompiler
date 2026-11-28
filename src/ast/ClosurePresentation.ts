import { cloneAst, type Chunk, type Expression, type FunctionExpression, type Statement } from "./Ast.js";
import { analyzeBindings } from "../analysis/Bindings.js";
import { isValidIdentifier } from "../reconstruct/Naming.js";
import {
  countIdentifier,
  forEachChildExpression,
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
 * exactly one reader it can return to that position when evaluation order
 * proves the creation still observes the same environment and captures.
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
  const localReads = new Set<object>();
  for (const binding of analyzeBindings(ast.body).bindings) {
    for (const reference of binding.reads) localReads.add(reference.node);
  }

  const body = rewriteBlocks(ast.body, (block) => {
    const merged = mergeForwardDeclarations(block.statements, unique, references);
    return { ...block, statements: inlineSingleUse(merged, unique, references, localReads) };
  });
  return { ...ast, body };
}

/** A record field gives a function literal the same debug name as a local
 * function declaration. Once constructor recovery has exposed that field,
 * an adjacent private binding can return to it without inventing a name or
 * moving creation across an effect. Resolve the sole use by lexical identity;
 * a recursive, captured, overwritten or shared function remains a binding. */
export function presentNamedTableClosures(ast: Chunk): Chunk {
  const result = cloneAst(ast);
  const { bindings } = analyzeBindings(result.body);
  const localReads = new Set<object>(bindings.flatMap(binding => binding.reads.map(read => read.node)));
  for (const binding of [...bindings].reverse()) {
    if (binding.captured || binding.writes.length !== 0 || binding.reads.length !== 1) continue;
    const declaration = binding.declaration;
    let fn: FunctionExpression;
    if (declaration.kind === "function-decl" && declaration.local &&
        binding.declarationIndex === undefined && isValidIdentifier(declaration.name)) {
      fn = { kind: "function-expr", debugName: declaration.name, params: declaration.params,
        paramTypes: declaration.paramTypes, returnType: declaration.returnType, isVararg: declaration.isVararg,
        body: declaration.body, line: declaration.line, closureIdentity: declaration.closureIdentity,
        creationSite: declaration.creationSite };
    } else if (declaration.kind === "local" && declaration.names.length === 1 && declaration.values.length === 1 &&
        declaration.values[0]?.kind === "function-expr" && declaration.values[0].debugName !== undefined) {
      fn = declaration.values[0];
    } else continue;
    if (fn.closureIdentity?.inlineCaptureInitializer || !fn.debugName || !isValidIdentifier(fn.debugName)) continue;
    const index = binding.scope.statements.indexOf(declaration as Statement);
    const consumer = binding.scope.statements[index + 1];
    if (index < 0 || !consumer || binding.reads[0]!.statement !== consumer ||
        (consumer.kind !== "local" && consumer.kind !== "assign" && consumer.kind !== "return")) continue;
    let field: Extract<Expression, {kind: "table"}>["fields"][number] | undefined;
    const visit = (expression: Expression): void => {
      if (expression.kind === "table") {
        // An export table is useful structure in its own right. Folding only
        // its adjacent suffix would arbitrarily split a group of named helpers
        // between standalone declarations and nested bodies. Mixed constructors
        // that already contain callbacks do not have that uniform structure.
        const namedHelpers = expression.fields.filter(candidate => candidate.value.kind === "identifier" &&
          (candidate.name ?? (candidate.key?.kind === "literal" ? candidate.key.value : undefined)) === candidate.value.name);
        const keepExports = namedHelpers.length > 1 &&
          !expression.fields.some(candidate => candidate.value.kind === "function-expr");
        for (const candidate of expression.fields) {
          const key = candidate.name ?? (candidate.key?.kind === "literal" ? candidate.key.value : undefined);
          if (!keepExports && !candidate.list && key === fn.debugName && candidate.value === binding.reads[0]!.node) field = candidate;
        }
      }
      forEachChildExpression(expression, visit);
    };
    consumer.values.forEach(visit);
    if (!field || !creationMotionIsOrdered(consumer, binding.name, fn, localReads)) continue;
    field.value = fn;
    binding.scope.statements.splice(index, 1);
  }
  return result;
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
            closureIdentity: fn.closureIdentity,
            creationSite: fn.creationSite,
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
  localReads: ReadonlySet<object>,
): Statement[] {
  const out = [...statements];
  for (let index = out.length - 1; index >= 0; index--) {
    const declaration = out[index]!;
    if (declaration.kind !== "local" || declaration.names.length !== 1 || declaration.values.length !== 1) continue;
    const name = declaration.names[0]!;
    const fn = declaration.values[0]!;
    if (fn.kind !== "function-expr" || fn.debugName !== undefined) continue;
    // Factory recovery relies on both the direct initializer and its original
    // creation point. Moving it into the call can cross an environment change.
    if (fn.closureIdentity?.inlineCaptureInitializer) continue;
    if (!unique(name) || references.get(name) !== 1) continue;
    // Creation observes the owner's environment at this point. A single use
    // does not permit moving the literal across another statement, nor past
    // a call/lookup in the immediately following statement.
    const consumer = out[index + 1];
    if (!consumer || !creationMotionIsOrdered(consumer, name, fn, localReads)) continue;
    const replaced = substituteOnce(consumer, name, fn);
    if (replaced) {
      out[index + 1] = replaced;
      out.splice(index, 1);
    }
  }
  return out;
}

/** A raw callback may follow receiver/argument preparation in the bytecode
 * even though those expressions are printed in its later CALL statement.
 * Keep that useful form only when the original SSA definition proves each
 * effectful prefix was already evaluated before the closure was created.
 * Otherwise every evaluation preceding the replacement must be inert. */
function creationMotionIsOrdered(
  statement: Statement,
  name: string,
  fn: FunctionExpression,
  localReads: ReadonlySet<object>,
): boolean {
  let ordered = true;
  let found = false;
  let conditional = 0;

  // A table store can throw even when evaluating its key/value cannot: nil
  // and NaN are invalid keys. The thrown error can make closure creation (and
  // DUPCLOSURE cache priming) observable to a later activation.
  const validKey = (key: Expression | undefined): boolean => key === undefined ||
    (key.kind === "literal" && key.value !== null &&
      !(typeof key.value === "number" && Number.isNaN(key.value)));

  const inert = (expression: Expression): boolean => {
    switch (expression.kind) {
      case "literal": case "vararg": return true;
      case "identifier": return localReads.has(expression);
      case "paren": return inert(expression.expression);
      case "unary": return expression.op === "not" && inert(expression.argument);
      case "table": return expression.fields.every(field => validKey(field.key) && inert(field.value));
      default: return false;
    }
  };
  const preparedBefore = (call: Extract<Expression, {kind: "call" | "method-call"}>, index: number): boolean => {
    const site = fn.creationSite;
    const definition = call.evaluation?.operandPcs[index];
    return !!site && call.evaluation?.ownerProtoId === site.ownerProtoId &&
      definition !== undefined && definition < site.pc;
  };
  const tableConstructor = (expression: Expression): boolean => expression.kind === "table" ||
    (expression.kind === "paren" && tableConstructor(expression.expression));
  const operand = (expression: Expression, prepared = false): void => {
    if (found) return;
    if (countIdentifier(expression, name) === 0) {
      // A table's SSA definition is the allocation, not its later field
      // initializers; that PC alone cannot order their effects.
      if (!inert(expression) && !(prepared && !tableConstructor(expression))) ordered = false;
      return;
    }
    visit(expression);
  };
  const visit = (expression: Expression): void => {
    if (found) return;
    if (expression.kind === "identifier" && expression.name === name) {
      found = true;
      ordered &&= conditional === 0;
      return;
    }
    switch (expression.kind) {
      case "paren": case "unary": operand(expression.kind === "paren" ? expression.expression : expression.argument); return;
      case "binary":
        operand(expression.left);
        if (expression.op === "and" || expression.op === "or") conditional += 1;
        operand(expression.right);
        if (expression.op === "and" || expression.op === "or") conditional -= 1;
        return;
      case "call":
        operand(expression.callee, preparedBefore(expression, 0));
        expression.args.forEach((argument, index) => operand(argument, preparedBefore(expression, index + 1)));
        return;
      case "method-call":
        // The official compiler evaluates the receiver before arguments but
        // emits NAMECALL (including __index) after them. Only receiver work
        // precedes a callback argument in this source form.
        operand(expression.object, preparedBefore(expression, 0));
        expression.args.forEach((argument, index) => operand(argument, preparedBefore(expression, index + 1)));
        return;
      case "property": operand(expression.object); return;
      case "index": operand(expression.table); operand(expression.key); return;
      case "table":
        expression.fields.forEach(field => {
          if (field.key) operand(field.key);
          operand(field.value);
          if (!found && !validKey(field.key)) ordered = false;
        });
        return;
      case "if-expr":
        operand(expression.test);
        conditional += 1;
        operand(expression.consequent);
        for (const branch of expression.branches) { operand(branch.test); operand(branch.value); }
        operand(expression.alternate);
        conditional -= 1;
        return;
      case "interp":
        for (const part of expression.parts) if (part.kind === "expr" && typeof part.value !== "string") {
          operand(part.value);
          // String conversion of an earlier part can invoke __tostring.
          if (!found && part.value.kind !== "literal") ordered = false;
        }
        return;
      // A read in a nested function body does not occur at its creation.
      default: ordered = false;
    }
  };
  const targets = (expression: Expression, reads: boolean): void => {
    if (expression.kind === "property") operand(expression.object);
    else if (expression.kind === "index") { operand(expression.table); operand(expression.key); }
    if (reads && (expression.kind !== "identifier" || !localReads.has(expression))) ordered = false;
  };
  switch (statement.kind) {
    case "local": case "return": statement.values.forEach(value => operand(value)); break;
    case "assign":
      statement.targets.forEach(target => targets(target, false));
      statement.values.forEach(value => operand(value));
      break;
    case "compound-assign": targets(statement.target, true); operand(statement.value); break;
    case "expression-stmt": operand(statement.expression); break;
    case "if": operand(statement.test); break;
    case "numeric-for": operand(statement.start); operand(statement.stop); if (statement.step) operand(statement.step); break;
    case "generic-for": statement.iterators.forEach(value => operand(value)); break;
    default: return false;
  }
  return found && ordered;
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
