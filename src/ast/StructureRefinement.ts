import { analyzeBindings } from "../analysis/Bindings.js";
import type { Block, Chunk, Expression, Statement } from "./Ast.js";
import { countIdentifier, endsInExit, mapChildExpressions, mapStatementExpressions } from "./AstWalk.js";

export interface StructureOptions {
  ifExpressions: boolean;
  /** Rewrite `else` after an exit into guard clauses. */
  guards: boolean;
}

type IfStatement = Extract<Statement, { kind: "if" }>;

/** Where control goes when a block runs off its end: the end of the function
 * (a bare `return` there is redundant) or the next iteration of a loop (a
 * `continue` there is redundant). */
type Tail = "function" | "loop" | undefined;

interface Context {
  tail: Tail;
  /** The block is the whole function or loop body, not a branch of it. */
  root: boolean;
  /** A repeat body: its locals stay visible to the `until` condition. */
  until?: Expression;
}

/**
 * Structural rewrites that keep every evaluation and its order.
 *
 * The compiler emits the same code for `if c then return end; rest` and
 * `if not c then rest end` at a tail, for `a and b` in a test and two nested
 * tests, and for a branch body shared by several conditions. These rewrites
 * choose the spelling a person would have written: guard clauses instead of
 * `else` after an exit, one condition instead of repeated identical arms,
 * and positive conditions instead of negated guards.
 */
export function refineStructure(ast: Chunk, options: StructureOptions): Chunk {
  const captured = new Set<string>();
  for (const binding of analyzeBindings(ast.body).bindings) {
    if (binding.captured) captured.add(binding.name);
  }
  const refiner = new Refiner(options, captured);
  return { ...ast, body: refiner.block(ast.body, { tail: "function", root: true }) };
}

class Refiner {
  constructor(private readonly options: StructureOptions, private readonly captured: ReadonlySet<string>) {}

  block(body: Block, context: Context): Block {
    const count = body.statements.length;
    let statements = body.statements.map((statement, index) =>
      this.statement(statement, index === count - 1 ? context.tail : undefined));
    statements = statements.map((statement) => (statement.kind === "if" ? mergeEqualArms(statement) : statement));
    statements = this.recoverValues(statements);
    statements = dropTailExit(statements, context);
    if (this.options.guards) statements = flattenExits(statements, context);
    if (this.options.guards) statements = wrapNegatedGuards(statements, context);
    statements = rebuildLadders(statements, context);
    const unchanged = statements.length === count && statements.every((statement, index) => statement === body.statements[index]);
    return unchanged ? body : { ...body, statements };
  }

  private statement(statement: Statement, tail: Tail): Statement {
    const mapped = mapStatementExpressions(statement, (expression) => this.expression(expression));
    // Shared arms are compared as emitted, before any of them loses a
    // redundant trailing return.
    const withExpressions = mapped.kind === "if" ? mergeEqualArms(mapped) : mapped;
    switch (withExpressions.kind) {
      case "function-decl":
        return this.withBody(withExpressions, this.block(withExpressions.body, { tail: "function", root: true }));
      case "while": {
        const refined = this.withBody(withExpressions, this.block(withExpressions.body, { tail: "loop", root: true }));
        return recoverLoopCondition(refined);
      }
      case "numeric-for":
      case "generic-for":
        return this.withBody(withExpressions, this.block(withExpressions.body, { tail: "loop", root: true }));
      case "repeat": {
        const refined = this.withBody(withExpressions,
          this.block(withExpressions.body, { tail: "loop", root: true, until: withExpressions.test }));
        // A trailing `if c then break end` runs right before the test: `until c or test`.
        // A `continue` jumps straight to the test and would start evaluating `c`.
        let { body, test } = refined;
        while (!continues(body)) {
          const last = body.statements.at(-1);
          if (!isGuard(last) || last.consequent.statements.length !== 1 || last.consequent.statements[0]!.kind !== "break") break;
          body = { ...body, statements: body.statements.slice(0, -1) };
          test = disjunction(last.test, test);
        }
        return body === refined.body ? refined : { ...refined, body, test };
      }
      case "do":
        return this.withBody(withExpressions, this.block(withExpressions.body, { tail, root: false }));
      case "if": {
        // Jumps to a final `return` are compiled as `return`, so an arm's bare
        // return may or may not have been written. A short arm beside a long
        // one, or beside one that returns a value, was a guard clause: keep
        // its return and let the other arm follow it.
        const kept = tail === "function" ? guardArm(withExpressions) : undefined;
        const arm = (body: Block): Block => this.block(body, { tail: body === kept ? undefined : tail, root: false });
        const consequent = arm(withExpressions.consequent);
        const branches = withExpressions.branches.map((branch) => {
          const next = arm(branch.body);
          return next === branch.body ? branch : { ...branch, body: next };
        });
        const alternate = withExpressions.alternate ? arm(withExpressions.alternate) : undefined;
        const unchanged = consequent === withExpressions.consequent && alternate === withExpressions.alternate &&
          branches.every((branch, index) => branch === withExpressions.branches[index]);
        return unchanged ? withExpressions : { ...withExpressions, consequent, branches, alternate };
      }
      default:
        return withExpressions;
    }
  }

  private withBody<T extends Statement & { body: Block }>(statement: T, body: Block): T {
    return body === statement.body ? statement : { ...statement, body };
  }

  private expression(expression: Expression): Expression {
    const mapped = mapChildExpressions(expression, (child) => this.expression(child));
    if (mapped.kind === "function-expr") {
      const body = this.block(mapped.body, { tail: "function", root: true });
      return body === mapped.body ? mapped : { ...mapped, body };
    }
    return simplifyExpression(mapped);
  }

  /** Assignments split across a test are one short-circuit or conditional value. */
  private recoverValues(statements: Statement[]): Statement[] {
    const out: Statement[] = [];
    for (const statement of statements) {
      const next = this.options.ifExpressions ? conditionalAssignment(statement) : statement;
      const previous = out.at(-1);
      const merged = previous ? this.mergeWithPrevious(previous, next) : undefined;
      if (merged) {
        out[out.length - 1] = merged;
      } else {
        out.push(next);
      }
    }
    return out;
  }

  private mergeWithPrevious(previous: Statement, statement: Statement): Statement | undefined {
    // `x = a; if x then x = b end`  is  `x = a and b`  (and `or` for `if not x`).
    const guarded = guardedReassignment(statement);
    if (guarded) {
      const assigned = singleStore(previous);
      if (assigned && assigned.name === guarded.name && assigned.value.kind !== "function-expr" &&
          countIdentifier(guarded.value, guarded.name) === 0 && !isPack(assigned.value) &&
          (previous.kind === "local" || !this.captured.has(guarded.name))) {
        const value: Expression = { kind: "binary", op: guarded.op, left: assigned.value, right: guarded.value };
        return withStoredValue(previous, simplifyExpression(value));
      }
    }
    // `local x` directly followed by its first assignment is one declaration.
    if (previous.kind === "local" && previous.names.length === 1 && previous.values.length === 0) {
      const assigned = singleStore(statement);
      const name = previous.names[0]!;
      if (assigned && statement.kind === "assign" && assigned.name === name && !this.captured.has(name) &&
          assigned.value.kind !== "function-expr" && countIdentifier(assigned.value, name) === 0) {
        return { ...previous, values: [assigned.value], types: undefined };
      }
    }
    return undefined;
  }
}

// ---------------------------------------------------------------- expressions

function simplifyExpression(expression: Expression): Expression {
  if (expression.kind === "binary" && (expression.op === "and" || expression.op === "or")) {
    // `and`/`or` are associative in both value and evaluation order.
    const right = expression.right;
    if (right.kind === "binary" && right.op === expression.op) {
      return simplifyExpression({
        ...expression,
        left: simplifyExpression({ ...expression, left: expression.left, right: right.left }),
        right: right.right,
      });
    }
  }
  if (expression.kind === "if-expr" && expression.branches.length === 0) {
    // `if c then (a or b) else b` selects exactly what `c and a or b` selects.
    const { consequent, alternate } = expression;
    if (consequent.kind === "literal" && alternate.kind === "literal" &&
        typeof consequent.value === "boolean" && typeof alternate.value === "boolean" &&
        consequent.value !== alternate.value) {
      const asBoolean = (value: Expression): Expression => {
        if ((value.kind === "literal" && typeof value.value === "boolean") ||
            (value.kind === "unary" && value.op === "not") ||
            (value.kind === "binary" && ["==", "~=", "<", "<=", ">", ">="].includes(value.op))) return value;
        return {kind: "unary", op: "not", argument: {kind: "unary", op: "not", argument: value}};
      };
      // Keep boolean coercion for arbitrary values, evaluate the test once,
      // and never invert an ordering comparison (which would change NaNs).
      if (consequent.value) return asBoolean(expression.test);
      if (expression.test.kind === "unary" && expression.test.op === "not")
        return asBoolean(expression.test.argument);
      return {kind: "unary", op: "not", argument: expression.test};
    }
    if (isInertLiteral(alternate) && consequent.kind === "binary" && consequent.op === "or" &&
        sameNode(consequent.right, alternate)) {
      return {
        kind: "binary", op: "or",
        left: { kind: "binary", op: "and", left: expression.test, right: consequent.left },
        right: alternate,
      };
    }
  }
  return expression;
}

function isInertLiteral(expression: Expression): boolean {
  return expression.kind === "literal";
}

function isPack(expression: Expression): boolean {
  return expression.kind === "vararg";
}

/** Negate a test. Only truthiness is observed, so `not not x` is `x` and
 * De Morgan applies; ordering comparisons keep an explicit `not` (NaN). */
export function negateTest(expression: Expression): Expression {
  if (expression.kind === "unary" && expression.op === "not") return expression.argument;
  if (expression.kind === "paren") return negateTest(expression.expression);
  if (expression.kind === "literal" && typeof expression.value === "boolean") return { ...expression, value: !expression.value };
  if (expression.kind === "binary") {
    if (expression.op === "==") return { ...expression, op: "~=" };
    if (expression.op === "~=") return { ...expression, op: "==" };
    if (expression.op === "and" || expression.op === "or") {
      return simplifyExpression({
        ...expression,
        op: expression.op === "and" ? "or" : "and",
        left: negateTest(expression.left),
        right: negateTest(expression.right),
      });
    }
  }
  return { kind: "unary", op: "not", argument: expression };
}

/** How awkward a test reads: a negated comparison needs parentheses. */
function negationCost(expression: Expression): number {
  let cost = 0;
  const visit = (node: Expression): void => {
    if (node.kind === "unary" && node.op === "not") {
      const argument = node.argument.kind === "paren" ? node.argument.expression : node.argument;
      cost += argument.kind === "binary" ? 2 : 1;
    }
    if (node.kind === "function-expr") return;
    mapChildExpressions(node, (child) => {
      visit(child);
      return child;
    });
  };
  visit(expression);
  return cost;
}

function conjunction(left: Expression, right: Expression): Expression {
  return simplifyExpression({ kind: "binary", op: "and", left, right });
}

function disjunction(left: Expression, right: Expression): Expression {
  return simplifyExpression({ kind: "binary", op: "or", left, right });
}


function sameNode(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (typeof left !== typeof right || left === null || right === null || typeof left !== "object") return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  if (Array.isArray(left)) {
    const other = right as unknown[];
    return left.length === other.length && left.every((item, index) => sameNode(item, other[index]));
  }
  const a = left as Record<string, unknown>;
  const b = right as Record<string, unknown>;
  const keys = Object.keys(a).filter((key) => a[key] !== undefined);
  if (keys.length !== Object.keys(b).filter((key) => b[key] !== undefined).length) return false;
  return keys.every((key) => sameNode(a[key], b[key]));
}

// ------------------------------------------------------------------ if arms

/** Arms that run the same statements need only one copy of them. */
function mergeEqualArms(statement: IfStatement): IfStatement {
  let current = statement;
  for (;;) {
    // if a then (if b then P else X end) else X end   ->   if a and b then P else X end
    const inner = current.consequent.statements.length === 1 ? current.consequent.statements[0] : undefined;
    if (current.branches.length === 0 && inner?.kind === "if" && inner.branches.length === 0) {
      if (!current.alternate && !inner.alternate) {
        current = { ...current, test: conjunction(current.test, inner.test), consequent: inner.consequent };
        continue;
      }
      if (current.alternate && inner.alternate && sameNode(current.alternate, inner.alternate)) {
        current = { ...current, test: conjunction(current.test, inner.test), consequent: inner.consequent };
        continue;
      }
      if (current.alternate && inner.alternate && sameNode(current.alternate, inner.consequent)) {
        current = { ...current, test: conjunction(current.test, negateTest(inner.test)), consequent: inner.alternate };
        continue;
      }
    }
    // if a then X elseif b then X ...   ->   if a or b then X ...
    const arms = [{ test: current.test, body: current.consequent }, ...current.branches];
    const repeated = arms.findIndex((arm, index) => index + 1 < arms.length && sameNode(arm.body, arms[index + 1]!.body));
    if (repeated >= 0) {
      const merged = { test: disjunction(arms[repeated]!.test, arms[repeated + 1]!.test), body: arms[repeated]!.body };
      const next = [...arms.slice(0, repeated), merged, ...arms.slice(repeated + 2)];
      current = { ...current, test: next[0]!.test, consequent: next[0]!.body, branches: next.slice(1) };
      continue;
    }
    return current;
  }
}

function isGuard(statement: Statement | undefined): statement is IfStatement {
  return statement?.kind === "if" && statement.branches.length === 0 && !statement.alternate;
}

function isBreakGuard(statement: Statement | undefined): statement is IfStatement {
  return isGuard(statement) && statement.consequent.statements.length === 1 &&
    statement.consequent.statements[0]!.kind === "break";
}

/** Rejoin the jumps of a loop test without moving an evaluation across work.
 * A head guard is evaluated on every entry, including after `continue`.
 * A latch guard can become `until` only when no continue of this loop can
 * skip it. Body locals retain their scope through the repeat condition. */
function recoverLoopCondition(statement: Extract<Statement, { kind: "while" }>): Statement {
  let { test, body } = statement;
  // An existing condition already explains this loop's entry. Keep explicit
  // body exits in that case instead of enlarging a readable header.
  if (test.kind !== "literal" || test.value !== true) return statement;
  let start = 0;
  while (isBreakGuard(body.statements[start])) {
    const guard = body.statements[start]! as IfStatement;
    const positive = negateTest(guard.test);
    test = test.kind === "literal" && test.value === true ? positive : conjunction(test, positive);
    start += 1;
  }
  if (start > 0) body = { ...body, statements: body.statements.slice(start) };
  if (test.kind === "literal" && test.value === true && !continues(body)) {
    let end = body.statements.length;
    while (isBreakGuard(body.statements[end - 1])) end -= 1;
    if (end < body.statements.length) {
      const tests = (body.statements.slice(end) as IfStatement[]).map(guard => guard.test);
      return { kind: "repeat", body: { ...body, statements: body.statements.slice(0, end) },
        test: tests.reduce(disjunction) };
    }
  }
  return body === statement.body ? statement : { ...statement, body, test };
}

/** Whether a `continue` of the enclosing loop occurs in this block. */
function continues(body: Block): boolean {
  return body.statements.some((statement) => {
    switch (statement.kind) {
      case "continue": return true;
      case "do": return continues(statement.body);
      case "if":
        return continues(statement.consequent) || statement.branches.some((branch) => continues(branch.body)) ||
          (statement.alternate !== undefined && continues(statement.alternate));
      default: return false;
    }
  });
}

function endsInBareReturn(body: Block): boolean {
  const last = body.statements.at(-1);
  return last?.kind === "return" && last.values.length === 0;
}

function blockSize(body: Block): number {
  let size = 0;
  for (const statement of body.statements) {
    size += 1;
    switch (statement.kind) {
      case "if":
        size += blockSize(statement.consequent) + (statement.alternate ? blockSize(statement.alternate) : 0);
        for (const branch of statement.branches) size += blockSize(branch.body);
        break;
      case "while": case "repeat": case "numeric-for": case "generic-for": case "do": case "function-decl":
        size += blockSize(statement.body);
        break;
      default:
        break;
    }
  }
  return size;
}

function guardArm(statement: IfStatement): Block | undefined {
  if (statement.branches.length > 0 || !statement.alternate) return undefined;
  const { consequent, alternate } = statement;
  const guards = (arm: Block, other: Block): boolean =>
    endsInBareReturn(arm) && arm.statements.length > 1 &&
    ((endsInExit(other) && !endsInBareReturn(other)) || (blockSize(arm) <= 3 && blockSize(other) >= blockSize(arm) + 2));
  if (guards(consequent, alternate)) return consequent;
  if (guards(alternate, consequent)) return alternate;
  return undefined;
}

// --------------------------------------------------------------------- exits

/** A bare `return`/`continue` where control would arrive anyway. */
function dropTailExit(statements: Statement[], context: Context): Statement[] {
  const last = statements.at(-1);
  if (!last || (statements.length === 1 && !context.root)) return statements;
  const redundant =
    (context.tail === "function" && last.kind === "return" && last.values.length === 0) ||
    (context.tail === "loop" && last.kind === "continue");
  return redundant ? statements.slice(0, -1) : statements;
}

/** No `else` after an arm that leaves: the rest follows the guard. */
function flattenExits(statements: Statement[], context: Context): Statement[] {
  const out: Statement[] = [];
  statements.forEach((statement, index) => {
    if (statement.kind !== "if") {
      out.push(statement);
      return;
    }
    const following = statements.slice(index + 1);
    const canHoist = (body: Block): boolean => hoistable(body, following, context);
    let current: IfStatement = statement;
    for (;;) {
      const rest = [...current.branches.map((branch) => branch.body), ...(current.alternate ? [current.alternate] : [])];
      if (rest.length === 0) break;
      if (endsInExit(current.consequent)) {
        if (current.branches.length > 0 && current.branches.every((branch) => endsInExit(branch.body))) {
          // A ladder of exits stays a ladder; its `else` is what follows it.
          if (!current.alternate || !canHoist(current.alternate)) break;
          out.push({ ...current, alternate: undefined }, ...current.alternate.statements);
          return;
        }
        if (current.branches.length > 0) {
          out.push({ kind: "if", test: current.test, consequent: current.consequent, branches: [] });
          const [next, ...others] = current.branches;
          current = { kind: "if", test: next!.test, consequent: next!.body, branches: others, alternate: current.alternate };
          continue;
        }
        if (!canHoist(current.alternate!)) break;
        out.push({ kind: "if", test: current.test, consequent: current.consequent, branches: [] },
          ...current.alternate!.statements);
        return;
      }
      if (current.branches.length === 0 && current.alternate && endsInExit(current.alternate) &&
          canHoist(current.consequent)) {
        out.push({ kind: "if", test: negateTest(current.test), consequent: current.alternate, branches: [] },
          ...current.consequent.statements);
        return;
      }
      break;
    }
    out.push(current);
  });
  return out;
}

/** Moving a branch body into the enclosing block widens the scope of its
 * locals. That is unobservable only when the block ends right there: no
 * later statement or `until` test can name them. */
function hoistable(body: Block, following: Statement[], context: Context): boolean {
  const declares = body.statements.some((statement) =>
    statement.kind === "local" || (statement.kind === "function-decl" && statement.local));
  return !declares || (following.length === 0 && !context.until);
}
/** `if not a then continue end; if not b then continue end; rest`  ->
 * `if a and b then rest end` when the positive test reads clearly better.
 * Consecutive guards are the separate jumps of one `and` condition. */
function wrapNegatedGuards(statements: Statement[], context: Context): Statement[] {
  if (!context.tail || context.until) return statements;
  const leavesTail = (statement: Statement | undefined): statement is IfStatement => {
    if (!isGuard(statement) || statement.consequent.statements.length !== 1) return false;
    const exit = statement.consequent.statements[0]!;
    return (context.tail === "function" && exit.kind === "return" && exit.values.length === 0) ||
      (context.tail === "loop" && exit.kind === "continue");
  };
  let out = statements;
  let index = out.length - 2;
  while (index >= 0) {
    if (!leavesTail(out[index])) {
      index -= 1;
      continue;
    }
    let start = index;
    while (start > 0 && leavesTail(out[start - 1])) start -= 1;
    const guards = out.slice(start, index + 1) as IfStatement[];
    const test = guards.map((guard) => guard.test).reduce(disjunction);
    const positive = negateTest(test);
    const rest = out.slice(index + 1);
    const saved = negationCost(test) - negationCost(positive);
    // A clearly positive test always wins; an equally clear one wins when
    // what it guards is a single statement rather than the rest of the body.
    const small = saved >= 0 && blockSize({ kind: "block", statements: rest }) <= 1;
    if (saved >= 2 || small) {
      const wrapped = mergeEqualArms({ kind: "if", test: positive, consequent: { kind: "block", statements: rest }, branches: [] });
      out = [...out.slice(0, start), wrapped];
    }
    index = start - 1;
  }
  return out;
}
/** `if a then X; continue end; if b then Y end` at a tail is the ladder
 * `if a then X elseif b then Y end`: the first arm skips the second either way. */
function rebuildLadders(statements: Statement[], context: Context): Statement[] {
  if (!context.tail) return statements;
  let out = statements;
  while (out.length >= 2) {
    const last = out[out.length - 1]!;
    const first = out[out.length - 2]!;
    if (last.kind !== "if" || !isGuard(first) || first.consequent.statements.length < 2) break;
    const exit = first.consequent.statements.at(-1)!;
    const leavesTail =
      (context.tail === "function" && exit.kind === "return" && exit.values.length === 0) ||
      (context.tail === "loop" && exit.kind === "continue");
    if (!leavesTail) break;
    const ladder: IfStatement = {
      kind: "if",
      test: first.test,
      consequent: { ...first.consequent, statements: first.consequent.statements.slice(0, -1) },
      branches: [{ test: last.test, body: last.consequent }, ...last.branches],
      alternate: last.alternate,
    };
    out = [...out.slice(0, -2), ladder];
  }
  return out;
}

// -------------------------------------------------------------------- values

function singleStore(statement: Statement): { name: string; value: Expression } | undefined {
  if (statement.kind === "local" && statement.names.length === 1 && statement.values.length === 1) {
    return { name: statement.names[0]!, value: statement.values[0]! };
  }
  if (statement.kind === "assign" && statement.targets.length === 1 && statement.values.length === 1 &&
      statement.targets[0]!.kind === "identifier") {
    return { name: statement.targets[0]!.name, value: statement.values[0]! };
  }
  return undefined;
}

function withStoredValue(statement: Statement, value: Expression): Statement {
  if (statement.kind === "local") return { ...statement, values: [value], types: undefined };
  if (statement.kind === "assign") return { ...statement, values: [value] };
  return statement;
}

/** `if x then x = b end` / `if not x then x = b end`. */
function guardedReassignment(statement: Statement): { name: string; op: "and" | "or"; value: Expression } | undefined {
  if (!isGuard(statement) || statement.consequent.statements.length !== 1) return undefined;
  const store = statement.consequent.statements[0]!;
  const assigned = store.kind === "assign" ? singleStore(store) : undefined;
  if (!assigned || assigned.value.kind === "function-expr") return undefined;
  const test = statement.test;
  if (test.kind === "identifier" && test.name === assigned.name) return { name: assigned.name, op: "and", value: assigned.value };
  if (test.kind === "unary" && test.op === "not" && test.argument.kind === "identifier" &&
      test.argument.name === assigned.name) {
    return { name: assigned.name, op: "or", value: assigned.value };
  }
  return undefined;
}

/** `if c then x = a else x = b end`  ->  `x = if c then a else b`. */
function conditionalAssignment(statement: Statement): Statement {
  if (statement.kind !== "if" || !statement.alternate) return statement;
  const arms = [statement.consequent, ...statement.branches.map((branch) => branch.body), statement.alternate];
  const stores = arms.map((arm) => (arm.statements.length === 1 && arm.statements[0]!.kind === "assign"
    ? singleStore(arm.statements[0]!) : undefined));
  const first = stores[0];
  if (!first || stores.some((store) => !store || store.name !== first.name || store.value.kind === "function-expr" ||
      store.value.kind === "vararg")) return statement;
  // Nested conditionals in one expression stop being readable.
  if (stores.length > 3 || stores.slice(0, -1).some((store) => store!.value.kind === "if-expr")) return statement;
  const value: Expression = simplifyExpression({
    kind: "if-expr",
    test: statement.test,
    consequent: first.value,
    branches: statement.branches.map((branch, index) => ({ test: branch.test, value: stores[index + 1]!.value })),
    alternate: stores.at(-1)!.value,
  });
  return { kind: "assign", targets: [{ kind: "identifier", name: first.name }], values: [value] };
}
