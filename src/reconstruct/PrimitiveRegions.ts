import {analyzeBindings, replaceReferences, type LexicalBinding} from '../analysis/Bindings.js';
import {cloneAst, ident, type Block, type Chunk, type Expression, type Statement} from '../ast/Ast.js';
import {NameAllocator} from './Naming.js';
import {rewriteRegisterCount} from './RegisterBudget.js';

type FunctionDeclaration = Extract<Statement, {kind: 'function-decl'}>;
type Loop = Extract<Statement, {kind: 'while' | 'repeat' | 'numeric-for' | 'generic-for'}>;
interface Target {
  fn: FunctionDeclaration;
  binding: LexicalBinding;
  params: LexicalBinding[];
  prefix: Statement[];
  result?: LexicalBinding;
  returns: Expression[];
}
interface Match {
  args: Map<LexicalBinding, Expression>;
  locals: Map<LexicalBinding, LexicalBinding>;
}
const NIL = 1, BOOLEAN = 2, NUMBER = 4, STRING = 8, ARRAY = 16;
const arithmetic = new Set(['+', '-', '*', '/', '//', '%', '^']);
const ordering = new Set(['<', '<=', '>', '>=']);
const unparen = (value: Expression): Expression => {
  while (value.kind === 'paren') value = value.expression;
  return value;
};

/** Recover a whole private primitive computation, including its loop state.
 *
 * Exact lexical matching establishes the computation; a separate type proof
 * excludes calls, globals, metamethods and environment reads. One fresh array
 * of primitive entries may be the argument of a native generic-for loop;
 * its allocation crosses only leading inert primitive declarations.
 * The added activation therefore has no observer in its body, whether or not
 * a compiler chooses to inline it. This pass never requests optimization 2.
 * Every helper return has a fixed primitive arity. The result declaration
 * requests exactly one value, including when the retained helper returns more.
 * Other copied locals must have no references outside the consumed region.
 */
export function recoverPrimitiveRegions(ast: Chunk, evidence: ReadonlySet<number>, recoveredHelpers?: Set<string>): Chunk {
  if (!evidence.size) return ast;
  const {bindings, globals} = analyzeBindings(ast.body);
  // A restored call needs its callee/argument/result window even when it
  // replaces locals. Do not rely on the native inliner to save registers.
  if (rewriteRegisterCount(bindings, ast.body) > 180) return ast;
  const names = new NameAllocator([...globals, ...bindings.map(binding => binding.name)]);
  const owners = new Map<object, LexicalBinding>();
  const declared = new Map<object, LexicalBinding[]>();
  for (const binding of bindings) {
    for (const ref of [...binding.reads, ...binding.writes]) owners.set(ref.node, binding);
    const group = declared.get(binding.declaration) ?? [];
    group.push(binding); declared.set(binding.declaration, group);
  }
  let budget = 100_000;
  // Matching, liveness and replacement use node identities. A shared syntax
  // node can denote two lexical occurrences, including an excluded closure
  // body. Decline DAG input rather than conflate those occurrences.
  if (!nodes(ast, false, true)) return ast;
  const replacements = new Map<object, object>();
  const primitiveBindings = new Map<LexicalBinding, number | undefined>();
  function literal(value: Extract<Expression, {kind: 'literal'}>['value']): number | undefined {
    return value === null ? NIL : typeof value === 'boolean' ? BOOLEAN : typeof value === 'number' ? NUMBER :
      typeof value === 'string' ? STRING : undefined;
  }
  function type(e: Expression, read: (binding: LexicalBinding) => number | undefined, depth = 0): number | undefined {
    if (--budget < 0 || depth > 32) return;
    const next = (value: Expression) => type(value, read, depth + 1);
    if (e.kind === 'paren') return next(e.expression);
    if (e.kind === 'literal') return literal(e.value);
    if (e.kind === 'identifier') { const owner = owners.get(e); return owner && read(owner); }
    if (e.kind === 'unary') {
      const value = next(e.argument);
      return e.op === 'not' && value ? BOOLEAN : e.op === '-' && value === NUMBER ? NUMBER :
        e.op === '#' && (value === STRING || value === ARRAY) ? NUMBER : undefined;
    }
    if (e.kind === 'binary') {
      const left = next(e.left), right = next(e.right);
      if (!left || !right) return;
      if (e.op === 'and' || e.op === 'or') return left | right;
      if (e.op === '==' || e.op === '~=') return BOOLEAN;
      if (arithmetic.has(e.op) && left === NUMBER && right === NUMBER) return NUMBER;
      if (ordering.has(e.op) && left === right && (left === NUMBER || left === STRING)) return BOOLEAN;
      return;
    }
    if (e.kind === 'if-expr') {
      if (!next(e.test) || e.branches.some(branch => !next(branch.test))) return;
      const values = [e.consequent, ...e.branches.map(branch => branch.value), e.alternate].map(next);
      return values.every(value => !!value) ? values.reduce<number>((all, value) => all | value!, 0) : undefined;
    }
  }
  function immutable(binding: LexicalBinding, seen = new Set<LexicalBinding>()): number | undefined {
    if (--budget < 0 || binding.writes.length || seen.has(binding)) return;
    if (primitiveBindings.has(binding)) return primitiveBindings.get(binding);
    const d = binding.declaration;
    if (d.kind === 'numeric-for') return NUMBER;
    if (d.kind !== 'local') return;
    const value = d.values[binding.declarationIndex!];
    if (!value) return d.values.length === 0 ? NIL : undefined;
    seen.add(binding);
    const result = type(value, owner => immutable(owner, seen));
    seen.delete(binding); primitiveBindings.set(binding, result); return result;
  }
  function arrayElements(e: Expression): number | undefined {
    e = unparen(e);
    if (--budget < 0 || e.kind !== 'table' || e.fields.length > 64) return;
    let elements = 0;
    for (const field of e.fields) {
      if (field.key || field.name !== undefined) return;
      const value = type(field.value, immutable);
      if (!value || value & ARRAY) return;
      elements |= value & ~NIL; // Native table iteration skips nil entries.
    }
    return elements || NIL;
  }
  const argumentType = (e: Expression) => arrayElements(e) ? ARRAY : type(e, immutable);
  function same(a: Expression, b: Expression, depth = 0): boolean {
    if (--budget < 0 || depth > 32) return false;
    a = unparen(a); b = unparen(b);
    if (a.kind === 'identifier' && b.kind === 'identifier') return !!owners.get(a) && owners.get(a) === owners.get(b);
    if (a.kind === 'literal' && b.kind === 'literal') return Object.is(a.value, b.value);
    if (a.kind === 'unary' && b.kind === 'unary') return a.op === b.op && same(a.argument, b.argument, depth + 1);
    if (a.kind === 'binary' && b.kind === 'binary') return a.op === b.op && same(a.left, b.left, depth + 1) && same(a.right, b.right, depth + 1);
    return false;
  }
  function matchExpression(p: Expression, v: Expression, target: Target, match: Match, depth = 0): boolean {
    if (--budget < 0 || depth > 32) return false;
    p = unparen(p); v = unparen(v);
    if (p.kind === 'identifier') {
      const owner = owners.get(p);
      if (!owner) return false;
      if (target.params.includes(owner)) {
        const kind = argumentType(v);
        if (!kind) return false;
        const prior = match.args.get(owner);
        // Two printed table constructors are two allocations, even if an AST
        // accidentally shares the node object. No structural table aliases.
        if (prior) return kind !== ARRAY && same(prior, v);
        match.args.set(owner, v); return true;
      }
      return v.kind === 'identifier' && !!match.locals.get(owner) && match.locals.get(owner) === owners.get(v);
    }
    const child = (a: Expression, b: Expression) => matchExpression(a, b, target, match, depth + 1);
    if (p.kind === 'literal' && v.kind === 'literal') return Object.is(p.value, v.value);
    if (p.kind === 'unary' && v.kind === 'unary') return p.op === v.op && child(p.argument, v.argument);
    if (p.kind === 'binary' && v.kind === 'binary') return p.op === v.op && child(p.left, v.left) && child(p.right, v.right);
    if (p.kind === 'if-expr' && v.kind === 'if-expr') return p.branches.length === v.branches.length &&
      child(p.test, v.test) && child(p.consequent, v.consequent) && child(p.alternate, v.alternate) &&
      p.branches.every((branch, i) => child(branch.test, v.branches[i]!.test) && child(branch.value, v.branches[i]!.value));
    return false;
  }
  function bind(p: object, v: object, match: Match): boolean {
    const left = declared.get(p), right = declared.get(v);
    if (!left?.length || left.length !== right?.length) return false;
    for (let i = 0; i < left.length; i++) {
      if (left[i]!.captured || right[i]!.captured || match.locals.has(left[i]!)) return false;
      match.locals.set(left[i]!, right[i]!);
    }
    return true;
  }
  function matchBlock(pattern: Statement[], actual: Statement[], target: Target, match: Match, depth = 0): boolean {
    if (--budget < 0 || depth > 24 || pattern.length !== actual.length) return false;
    const expr = (a: Expression, b: Expression) => matchExpression(a, b, target, match);
    const body = (a: Block, b: Block) => matchBlock(a.statements, b.statements, target, match, depth + 1);
    return pattern.every((p, index) => {
      if (--budget < 0) return false;
      const v = actual[index]!;
      if (p.kind === 'local' && v.kind === 'local') return p.names.length === v.names.length &&
        p.values.length === v.values.length && p.values.every((value, i) => expr(value, v.values[i]!)) && bind(p, v, match);
      if (p.kind === 'assign' && v.kind === 'assign') return p.targets.length === v.targets.length &&
        p.values.length === v.values.length && p.targets.every((value, i) => expr(value, v.targets[i]!)) &&
        p.values.every((value, i) => expr(value, v.values[i]!));
      if (p.kind === 'compound-assign' && v.kind === 'compound-assign') return p.op === v.op && expr(p.target, v.target) && expr(p.value, v.value);
      if (p.kind === 'if' && v.kind === 'if') return p.branches.length === v.branches.length &&
        !!p.alternate === !!v.alternate && expr(p.test, v.test) && body(p.consequent, v.consequent) &&
        p.branches.every((branch, i) => expr(branch.test, v.branches[i]!.test) && body(branch.body, v.branches[i]!.body)) &&
        (!p.alternate || body(p.alternate, v.alternate!));
      if (p.kind === 'while' && v.kind === 'while') return expr(p.test, v.test) && body(p.body, v.body);
      if (p.kind === 'repeat' && v.kind === 'repeat') return body(p.body, v.body) && expr(p.test, v.test);
      if (p.kind === 'numeric-for' && v.kind === 'numeric-for') return !!p.step === !!v.step && expr(p.start, v.start) &&
        expr(p.stop, v.stop) && (!p.step || expr(p.step, v.step!)) && bind(p, v, match) && body(p.body, v.body);
      if (p.kind === 'generic-for' && v.kind === 'generic-for') return p.iterators.length === 1 && v.iterators.length === 1 &&
        p.names.length <= 2 && expr(p.iterators[0]!, v.iterators[0]!) && bind(p, v, match) && body(p.body, v.body);
      if (p.kind === 'do' && v.kind === 'do') return body(p.body, v.body);
      return p.kind === v.kind && (p.kind === 'break' || p.kind === 'continue');
    });
  }
  /** A whole-binding fixed point proves every value ever stored, including
   * a loop-carried cell. Types are an overestimate; uncertainty rejects. */
  function primitive(target: Target, match: Match): boolean {
    const state = new Map<LexicalBinding, number>();
    let arrays = 0;
    for (const param of target.params) {
      const value = match.args.get(param), kind = value && argumentType(value);
      if (!kind) return false;
      if (kind === ARRAY) arrays++;
      state.set(param, kind);
    }
    if (arrays) {
      const loopIndex = target.prefix.findIndex(s => s.kind === 'generic-for');
      if (arrays !== 1 || loopIndex < 0 || target.prefix.slice(0, loopIndex).some(s =>
          s.kind !== 'local' || s.values.some(e => unparen(e).kind !== 'literal'))) return false;
    }
    const statements: Statement[] = [], loops: Loop[] = [];
    const pending: Array<[Statement[], number]> = [[target.prefix, 0]];
    while (pending.length) {
      if (--budget < 0 || statements.length > 128) return false;
      const [body, depth] = pending.pop()!;
      for (const s of body) {
        statements.push(s);
        if (s.kind === 'local' && s.values.length <= s.names.length) {
          for (const binding of declared.get(s) ?? []) state.set(binding, 0);
        } else if (s.kind === 'assign' || s.kind === 'compound-assign') {
          const targets = s.kind === 'assign' ? s.targets : [s.target];
          if (targets.some(e => e.kind !== 'identifier' || !match.locals.has(owners.get(e)!) || owners.get(e)!.captured)) return false;
          if (s.kind === 'assign' && s.targets.length !== s.values.length) return false;
        } else if (s.kind === 'if') {
          pending.push([s.consequent.statements, depth], ...s.branches.map(branch => [branch.body.statements, depth] as [Statement[], number]));
          if (s.alternate) pending.push([s.alternate.statements, depth]);
        } else if (s.kind === 'while' || s.kind === 'repeat' || s.kind === 'numeric-for' || s.kind === 'generic-for') {
          loops.push(s); pending.push([s.body.statements, depth + 1]);
          if (s.kind === 'numeric-for') for (const binding of declared.get(s) ?? []) state.set(binding, NUMBER);
          if (s.kind === 'generic-for') {
            const iterator = s.iterators[0] && unparen(s.iterators[0]);
            const parameter = iterator?.kind === 'identifier' ? owners.get(iterator) : undefined;
            const argument = parameter && match.args.get(parameter), elements = argument && arrayElements(argument);
            if (s.iterators.length !== 1 || s.names.length > 2 || !elements) return false;
            for (const binding of declared.get(s) ?? []) state.set(binding, binding.declarationIndex === 0 ? NUMBER : elements);
          }
        } else if (s.kind === 'do') pending.push([s.body.statements, depth]);
        else if ((s.kind !== 'break' && s.kind !== 'continue') || !depth) return false;
      }
    }
    if (!loops.length || loops.length > 8 || statements.length > 128) return false;
    const valueType = (e: Expression) => type(e, owner => state.get(owner));
    function writes(s: Statement): Array<[LexicalBinding | undefined, Expression | undefined]> {
      if (s.kind === 'local') return (declared.get(s) ?? []).map(binding => [binding, s.values[binding.declarationIndex!]]);
      if (s.kind === 'assign') return s.targets.map((value, index) => [owners.get(value), s.values[index]]);
      if (s.kind === 'compound-assign') return [[owners.get(s.target), {kind: 'binary', op: s.op, left: s.target, right: s.value}]];
      return [];
    }
    let converged = false;
    for (let round = 0; round <= state.size * 5; round++) {
      let changed = false;
      for (const s of statements) for (const [binding, value] of writes(s)) {
        if (--budget < 0 || !binding || !state.has(binding)) return false;
        const kind = value ? valueType(value) : NIL;
        const prior = state.get(binding)!;
        if (kind && (kind | prior) !== prior) {state.set(binding, kind | prior); changed = true;}
      }
      if (!changed) {converged = true; break;}
    }
    if (!converged) return false;
    for (const s of statements) {
      if (--budget < 0) return false;
      if (writes(s).some(([binding, value]) => {
        const kind = value ? valueType(value) : NIL, known = binding && state.get(binding);
        return !kind || !known || (kind | known) !== known;
      })) return false;
      if ((s.kind === 'while' || s.kind === 'repeat') && !valueType(s.test)) return false;
      if (s.kind === 'if' && (!valueType(s.test) || s.branches.some(branch => !valueType(branch.test)))) return false;
      if (s.kind === 'numeric-for' && (valueType(s.start) !== NUMBER || valueType(s.stop) !== NUMBER || s.step && valueType(s.step) !== NUMBER)) return false;
    }
    return target.returns.every(value => {const kind = valueType(value); return !!kind && !(kind & ARRAY);});
  }
  function target(fn: FunctionDeclaration): Target | undefined {
    if (!fn.local || fn.isVararg || !fn.line || !evidence.has(fn.line) || fn.params.length > 8) return;
    const group = declared.get(fn) ?? [], binding = group.find(b => b.scope !== fn.body);
    const params = group.filter(b => b.scope === fn.body);
    if (!binding || binding.writes.length || params.length !== fn.params.length || params.some(b => b.writes.length)) return;
    const last = fn.body.statements.at(-1);
    if (last?.kind !== 'return' || !last.values.length || last.values.length > 4) return;
    const first = unparen(last.values[0]!);
    const result = first.kind === 'identifier' ? owners.get(first) : undefined;
    const prefix = fn.body.statements.slice(0, -1);
    if (prefix.length < 2 || prefix.length > 12 || !prefix.some(s => s.kind === 'local')) return;
    const directResult = result && !result.captured && result.declaration.kind === 'local' && prefix.includes(result.declaration) ? result : undefined;
    const members = nodes(prefix);
    const allowed = new Set(['block', 'local', 'assign', 'compound-assign', 'if', 'while', 'repeat', 'numeric-for', 'generic-for',
      'break', 'continue', 'do', 'identifier', 'literal', 'unary', 'binary', 'if-expr', 'paren']);
    if (!members || members.size > 256 || ![...members].some(node => ['while', 'repeat', 'numeric-for', 'generic-for'].includes((node as Statement).kind)) ||
        [...members].some(node => (node as Statement).kind && !allowed.has((node as Statement).kind))) return;
    return {fn, binding, params, prefix, result: directResult, returns: last.values};
  }
  function nodes(root: unknown, immediate = false, unique = false): Set<object> | undefined {
    const result = new Set<object>(), pending = [root];
    while (pending.length) {
      if (--budget < 0) return;
      const value = pending.pop();
      if (!value || typeof value !== 'object') continue;
      const kind = (value as {kind?: string}).kind;
      if (unique && kind !== undefined && result.has(value)) return;
      result.add(value);
      // A consumer expression must execute in this activation. Searching a
      // closure body could replace its constant return with a new upvalue;
      // even a primitive NaN capture changes DUPCLOSURE identity sharing.
      if (immediate && (kind === 'function-expr' || kind === 'function-decl' || kind === 'block')) continue;
      if (Array.isArray(value)) pending.push(...value);
      else for (const [key, child] of Object.entries(value))
        if (!['definition', 'debugDeclaration', 'closureIdentity', 'creationSite', 'evaluation'].includes(key)) pending.push(child);
    }
    return result;
  }
  function visible(e: Expression, scope: Map<string, LexicalBinding>): boolean {
    const refs = nodes(e);
    return !!refs && [...refs].every(node => {
      const binding = owners.get(node);
      return !binding || scope.get(binding.name) === binding;
    });
  }
  function region(body: Block, start: number, available: Map<string, Target>, scope: Map<string, LexicalBinding>):
      {count: number; statement: Statement; helper: string; replace?: [Expression, Expression]} | undefined {
    let selected: {count: number; statement: Statement; helper: string; replace?: [Expression, Expression]} | undefined;
    for (const target of available.values()) {
      if (--budget < 0 || start + target.prefix.length > body.statements.length) continue;
      const actual = body.statements.slice(start, start + target.prefix.length);
      const match: Match = {args: new Map(), locals: new Map()};
      if (!matchBlock(target.prefix, actual, target, match)) continue;
      const result = target.result && match.locals.get(target.result), members = nodes(actual);
      if (!members) continue;
      if (!result) {
        const consumer = body.statements[start + actual.length], values = nodes(consumer, true);
        if (!consumer || !values) continue;
        const expressions = [...values].filter((node): node is Expression =>
          ['identifier', 'literal', 'unary', 'binary', 'if-expr'].includes((node as Expression).kind));
        let hit: {value: Expression; match: Match} | undefined, ambiguous = false;
        for (const value of expressions) {
          const trial = {args: new Map(match.args), locals: new Map(match.locals)};
          if (!matchExpression(target.returns[0]!, value, target, trial)) continue;
          const resultNodes = nodes(value);
          if (!resultNodes || [...trial.locals.values()].some(binding => [...binding.reads, ...binding.writes]
              .some(ref => !members.has(ref.node) && !resultNodes.has(ref.node)))) continue;
          if (hit) {ambiguous = true; break;}
          hit = {value, match: trial};
        }
        if (ambiguous || !hit || hit.match.args.size !== target.params.length || !primitive(target, hit.match)) continue;
        const args = target.params.map(param => hit!.match.args.get(param)!);
        if (!args.every(arg => visible(arg, scope))) continue;
        if (selected) return;
        const call: Expression = {kind: 'call', callee: ident(target.binding.name), args: cloneAst(args), open: false};
        if (consumer.kind === 'local' && consumer.names.length === 1 && consumer.values.length === 1 && consumer.values[0] === hit.value) {
          selected = {count: actual.length + 1, statement: {...consumer, values: [call]}, helper: target.binding.name};
        } else {
          const name = names.reserve('inlineResult');
          selected = {count: actual.length, statement: {kind: 'local', names: [name], values: [call]},
            helper: target.binding.name, replace: [hit.value, ident(name)]};
        }
        continue;
      }
      if (match.args.size !== target.params.length || !primitive(target, match) || result.scope !== body || result.declaration.kind !== 'local') continue;
      // Preserve the selected result cell, but no other copied local can
      // escape into a later statement, closure, loop condition or writer.
      if ([...match.locals.values()].some(binding => binding !== result &&
          [...binding.reads, ...binding.writes].some(ref => !members.has(ref.node)))) continue;
      const args = target.params.map(param => match.args.get(param)!);
      if (!args.every(arg => visible(arg, scope))) continue;
      if (selected) return; // Competing helpers decline rather than guess.
      const d = result.declaration, index = result.declarationIndex!;
      const statement: Statement = {kind: 'local', names: [result.name], values: [{kind: 'call',
        callee: ident(target.binding.name), args: cloneAst(args), open: false}],
        ...(d.types ? {types: [d.types[index]]} : {})};
      selected = {count: actual.length, statement, helper: target.binding.name};
    }
    return budget > 0 ? selected : undefined;
  }
  function walk(body: Block, inherited: Map<string, Target>, inheritedScope: Map<string, LexicalBinding>): void {
    if (--budget < 0) return;
    const available = new Map(inherited), scope = new Map(inheritedScope), output: Statement[] = [];
    let changed = false;
    const bindScope = (node: object) => {
      const nested = new Map(scope);
      for (const binding of declared.get(node) ?? []) nested.set(binding.name, binding);
      return nested;
    };
    for (let i = 0; i < body.statements.length; i++) {
      const s = body.statements[i]!;
      const found = region(body, i, available, scope);
      if (found) {
        if (found.replace) replacements.set(...found.replace);
        output.push(found.statement); recoveredHelpers?.add(found.helper); changed = true;
        for (const consumed of body.statements.slice(i, i + found.count)) for (const binding of declared.get(consumed) ?? []) {
          scope.set(binding.name, binding); available.delete(binding.name);
        }
        i += found.count - 1; continue;
      }
      output.push(s);
      if (s.kind === 'function-decl') {
        const group = declared.get(s) ?? [];
        for (const binding of group.filter(b => b.scope !== s.body)) {scope.set(binding.name, binding); available.delete(binding.name);}
        const members = nodes(s.body);
        const captured = new Set(bindings.filter(b => b.reads.some(ref => members?.has(ref.node)) && b.depth < (group.find(b => b.scope === s.body)?.depth ?? Infinity)));
        const inherited = new Map([...available].filter(([, value]) => captured.has(value.binding)));
        walk(s.body, inherited, bindScope(s));
        const candidate = target(s);
        if (candidate) available.set(candidate.binding.name, candidate);
      } else if (s.kind === 'local') {
        for (const binding of declared.get(s) ?? []) {scope.set(binding.name, binding); available.delete(binding.name);}
      } else if (s.kind === 'if') {
        walk(s.consequent, available, scope); for (const branch of s.branches) walk(branch.body, available, scope);
        if (s.alternate) walk(s.alternate, available, scope);
      } else if (s.kind === 'while' || s.kind === 'repeat' || s.kind === 'do') walk(s.body, available, scope);
      else if (s.kind === 'numeric-for' || s.kind === 'generic-for') {
        const names = bindScope(s), targets = new Map([...available].filter(([name, value]) => names.get(name) === value.binding));
        walk(s.body, targets, names);
      }
    }
    if (changed) replacements.set(body, replaceReferences({...body, statements: output}, replacements));
  }
  walk(ast.body, new Map(), new Map());
  return replacements.size ? replaceReferences(ast, replacements) : ast;
}
