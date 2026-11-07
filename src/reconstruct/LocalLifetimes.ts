import {block, type Block, type Chunk, type Statement, type Expression} from '../ast/Ast.js';
import {analyzeBindings, replaceReferences, type LexicalBinding} from '../analysis/Bindings.js';

/** Close completed lexical lifetimes in large reconstructed blocks. Luau limits
 * active locals, even when most register values are no longer live. This final
 * pass fuses proven ordered argument temporaries, then encloses dependency-
 * closed intervals in do. Captures and writes count as uses; repeat conditions
 * retain body visibility. */
export function boundLocalLifetimes(ast: Chunk, options: {foldSingleUseTemps?: boolean} = {}): Chunk {
  const result = structuredClone(ast);
  const visit = (node: unknown, repeatBody = false): void => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {node.forEach(value => visit(value)); return;}
    const record = node as Record<string, unknown>;
    for (const [key, child] of Object.entries(record)) visit(child, record.kind === 'repeat' && key === 'body');
    if (record.kind === 'block' && !repeatBody) closeLifetimes(node as Block, options.foldSingleUseTemps !== false);
  };
  visit(result);
  return result;
}

function closeLifetimes(body: Block, fold: boolean): void {
  // Binding/arity safety is mandatory when the uncollapsed form would exceed
  // Luau's local register budget, even with optional folding switched off.
  const pressure = body.statements.reduce((n, s) => n + (s.kind === 'local' ? s.names.length : s.kind === 'function-decl' && s.local ? 1 : 0), 0);
  if (fold || pressure >= 128) {
    inlineArgumentLiterals(body);
    foldOrderedArguments(body);
    foldAdjacentCallees(body);
  }
  const count = body.statements.reduce((n, s) => n + (s.kind === 'local' ? s.names.length : s.kind === 'function-decl' && s.local ? 1 : 0), 0);
  if (count < 128) return;
  // Map every nested reference's owning statement back to this block. A closure
  // body belongs to its creation statement, while later writes keep its cell live.
  const owners = new Map<object, number>();
  const index = (node: unknown, owner: number): void => {
    if (!node || typeof node !== 'object') return;
    owners.set(node, owner);
    Object.values(node).forEach(child => index(child, owner));
  };
  body.statements.forEach((s, i) => index(s, i));
  const lastUse = new Map<number, number>();
  for (const binding of analyzeBindings(body).bindings) {
    if (binding.scope !== body) continue;
    const start = owners.get(binding.declaration);
    if (start === undefined) continue;
    let end = lastUse.get(start) ?? start;
    for (const use of [...binding.reads, ...binding.writes]) end = Math.max(end, owners.get(use.statement) ?? body.statements.length - 1);
    lastUse.set(start, end);
  }
  const finalDeclaration = Math.max(...lastUse.keys());
  const result: Statement[] = [];
  for (let i = 0; i < body.statements.length; i++) {
    let end = lastUse.get(i);
    if (end !== undefined) {
      // Bound work and avoid replacing one oversized scope with another. If a
      // declaration crosses this window, leave it at its existing lexical owner.
      const ceiling = i + 128;
      for (let j = i; j <= end && end < ceiling; j++) end = Math.max(end, lastUse.get(j) ?? j);
      // Closing a scope only frees space for subsequent declarations. Do not
      // wrap the final use region: an extra lexical boundary there prevents
      // Luau from reusing dead parent registers for a wide call/return pack.
      if (end < ceiling && end < finalDeclaration) {
        result.push({kind: 'do', body: block(body.statements.slice(i, end + 1))});
        i = end;
        continue;
      }
    }
    result.push(body.statements[i]!);
  }
  body.statements = result;
}

/** A call's argument slots are already ordered. Fuse only a consecutive chain
 * of single-use locals in that same order. A stable lexical callee and inert
 * preceding arguments are required, so no lookup/effect crosses a call. */
function foldOrderedArguments(body: Block): void {
  const {bindings} = analyzeBindings(body);
  const resolved = new Map<Expression, LexicalBinding>();
  const declarations = new Map<Statement, LexicalBinding>();
  for (const binding of bindings) {
    if (binding.declaration.kind === 'local') declarations.set(binding.declaration, binding);
    for (const reference of binding.reads) resolved.set(reference.node, binding);
  }
  const stable = (expression: Expression): boolean => expression.kind === 'literal' ||
    (expression.kind === 'identifier' && resolved.has(expression) && !resolved.get(expression)!.writes.length);
  for (let i = 1; i < body.statements.length; i++) {
    const consumer = body.statements[i]!;
    const call = statementCall(consumer);
    // A named single return (especially a module) carries useful source identity.
    const values = call?.args ?? (consumer.kind === 'return' && consumer.values.length > 1 ? consumer.values : undefined);
    if (!values || (call && !stable(call.callee))) continue;
    const selected = new Map<number, Expression>();
    let cursor = i - 1, nextIndex = values.length;
    for (; cursor >= 0; cursor--) {
      const declaration = body.statements[cursor]!;
      const binding = declarations.get(declaration);
      if (declaration.kind !== 'local' || declaration.names.length !== 1 || declaration.values.length !== 1 ||
          !binding || binding.captured || binding.writes.length || binding.reads.length !== 1) break;
      const index = values.indexOf(binding.reads[0]!.node);
      if (index < 0 || index >= nextIndex) break;
      selected.set(index, declaration.values[0]!);
      nextIndex = index;
    }
    if (!selected.size) continue;
    const last = Math.max(...selected.keys());
    if (values.slice(0, last).some((value, index) => !selected.has(index) && !stable(value))) continue;
    // A callee cannot be one of the locals being removed (its only read would
    // then be the callee rather than an argument). Preserve fixed result arity.
    for (const [index, value] of selected) values[index] = index === values.length - 1 &&
      ['call', 'method-call', 'vararg'].includes(value.kind) ? {kind: 'paren', expression: value} : value;
    const removed = i - cursor - 1;
    body.statements.splice(cursor + 1, removed);
    i -= removed;
  }
}

/** Undo a callee snapshot when its call is now immediately adjacent. This
 * restores a direct call without moving the lookup across any argument effect. */
function foldAdjacentCallees(body: Block): void {
  const {bindings} = analyzeBindings(body);
  const declarations = new Map(bindings.map(binding => [binding.declaration, binding]));
  for (let i = 0; i + 1 < body.statements.length; i++) {
    const declaration = body.statements[i]!, consumer = body.statements[i + 1]!;
    if (declaration.kind !== 'local' || declaration.names.length !== 1 || declaration.values.length !== 1) continue;
    const binding = declarations.get(declaration);
    if (!binding || binding.captured || binding.writes.length || binding.reads.length !== 1) continue;
    const value = statementCall(consumer);
    if (!value || value.callee !== binding.reads[0]!.node) continue;
    value.callee = declaration.values[0]!;
    body.statements.splice(i, 1);
    i--;
  }
}

/** Literal-only argument setup cannot observe effects. Substituting resolved
 * single-use reads removes barriers between an ordered argument chain and its
 * consumer without moving calls or capturing a same-spelled binding. */
function inlineArgumentLiterals(body: Block): void {
  const replacements = new Map<object, object>(), removed = new Set<Statement>();
  for (const binding of analyzeBindings(body).bindings) {
    const declaration = binding.declaration;
    if (binding.scope !== body || declaration.kind !== 'local' || declaration.names.length !== 1 ||
        declaration.values.length !== 1 || declaration.values[0]!.kind !== 'literal' ||
        binding.captured || binding.writes.length || binding.reads.length !== 1) continue;
    const read = binding.reads[0]!;
    // Limit this to call setup, preserving literals used as other source-level
    // variables (including return values and constructor fields).
    if (read.statement.kind !== 'expression-stmt' || read.statement.expression.kind !== 'call') continue;
    replacements.set(read.node, declaration.values[0]!);
    removed.add(declaration);
  }
  if (removed.size) body.statements = replaceReferences(body.statements.filter(statement => !removed.has(statement)), replacements);
}

function statementCall(statement: Statement): Extract<Expression, {kind: 'call'}> | undefined {
  let value = statement.kind === 'expression-stmt' ? statement.expression :
    (statement.kind === 'local' || statement.kind === 'return' ||
      (statement.kind === 'assign' && statement.targets.every(target => target.kind === 'identifier'))) &&
      statement.values.length === 1 ? statement.values[0] : undefined;
  while (value?.kind === 'paren') value = value.expression;
  return value?.kind === 'call' ? value : undefined;
}
