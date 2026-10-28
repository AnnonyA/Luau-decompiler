import type {Block, Chunk, Expression, Statement} from '../ast/Ast.js';
import {ident} from '../ast/Ast.js';
import {analyzeBindings, replaceReferences, type LexicalBinding} from '../analysis/Bindings.js';
import {lineAt, type BytecodeModule} from '../decode/Prototype.js';
import {Opcode} from '../decode/Opcode.js';

const arithmetic = new Set(['+', '-', '*', '/', '//', '%', '^']);
const comparisons = new Set(['<', '<=', '>', '>=', '==', '~=']);
const evidenceOpcodes = new Set([Opcode.ADD, Opcode.SUB, Opcode.MUL, Opcode.DIV, Opcode.IDIV, Opcode.MOD, Opcode.POW,
  Opcode.ADDK, Opcode.SUBK, Opcode.MULK, Opcode.DIVK, Opcode.IDIVK, Opcode.MODK, Opcode.POWK, Opcode.SUBRK,
  Opcode.DIVRK, Opcode.MINUS, Opcode.JUMPIFEQ, Opcode.JUMPIFNOTEQ, Opcode.JUMPIFLT, Opcode.JUMPIFLE,
  Opcode.JUMPIFNOTLT, Opcode.JUMPIFNOTLE, Opcode.JUMPXEQKN]);

/** Line overlap admits a candidate; it never proves that a rewrite is safe.
 * Stripped/ambiguous metadata simply leaves the original expression in place. */
export function inlineHelperLines(module: BytecodeModule): Set<number> {
  const owners = new Map<number, Set<number>>(), bodyLines = new Map<number, Set<number>>();
  const definitions = new Map<number, number>();
  for (const proto of module.prototypes) {
    // A chunk starts at line 1 too; it is not a competing local helper.
    if (proto.id !== module.mainProtoId)
      definitions.set(proto.lineDefined, (definitions.get(proto.lineDefined) ?? 0) + 1);
    if (!proto.lineInfo) continue;
    const lines = new Set<number>();
    for (const instruction of proto.instructions) {
      if (!evidenceOpcodes.has(instruction.opcode)) continue;
      const line = lineAt(proto, instruction.pc);
      if (line === undefined) continue;
      lines.add(line);
      let ids = owners.get(line);
      if (!ids) owners.set(line, ids = new Set());
      ids.add(proto.id);
    }
    bodyLines.set(proto.id, lines);
  }
  const result = new Set<number>();
  for (const proto of module.prototypes) {
    if (proto.id === module.mainProtoId || !proto.lineDefined || definitions.get(proto.lineDefined) !== 1) continue;
    if ([...(bodyLines.get(proto.id) ?? [])].some(line => owners.get(line)!.size > 1)) result.add(proto.lineDefined);
  }
  return result;
}

interface Target {
  name: string;
  expression: Expression;
  parameters: Map<LexicalBinding, number>;
  count: number;
}
type Available = Map<string, Target>;
const unparen = (expression: Expression): Expression => {
  while (expression.kind === 'paren') expression = expression.expression;
  return expression;
};

/** Recover existing numeric helper calls from exact expression copies. The
 * body and all substituted arguments must operate on proven primitive numbers:
 * moving an unknown value into a call could expose a different __add/debug.info
 * frame, eager evaluation, errors or multiple-return behavior. No algebraic
 * reassociation, free captures, unknown calls or guessed argument inversions. */
export function recoverInlineCalls(ast: Chunk, evidence: ReadonlySet<number>): Chunk {
  if (!evidence.size) return ast;
  const {bindings} = analyzeBindings(ast.body);
  const owners = new Map<object, LexicalBinding>(), declarations = new Map<object, LexicalBinding[]>();
  for (const binding of bindings) {
    for (const read of binding.reads) owners.set(read.node, binding);
    const list = declarations.get(binding.declaration) ?? [];
    list.push(binding); declarations.set(binding.declaration, list);
  }
  const numericBindings = new Map<LexicalBinding, boolean>();
  const numericValues = new Map<Expression, boolean>();
  let budget = 100_000;
  function numeric(expression: Expression, seen = new Set<LexicalBinding>()): boolean {
    if (--budget < 0) return false;
    const e = unparen(expression);
    const cached = numericValues.get(e);
    if (cached !== undefined) return cached;
    if (e.kind === 'literal') return typeof e.value === 'number';
    if (e.kind === 'unary' || e.kind === 'binary') {
      const result = e.kind === 'unary' ? e.op === '-' && numeric(e.argument, seen) :
        arithmetic.has(e.op) && numeric(e.left, seen) && numeric(e.right, seen);
      numericValues.set(e, result);
      return result;
    }
    if (e.kind !== 'identifier') return false;
    const binding = owners.get(e);
    if (!binding || binding.writes.length || seen.has(binding)) return false;
    if (numericBindings.has(binding)) return numericBindings.get(binding)!;
    const declaration = binding.declaration;
    seen.add(binding);
    const value = declaration.kind === 'local' ? declaration.values[binding.declarationIndex!] : undefined;
    const result = declaration.kind === 'numeric-for' || !!value && numeric(value, seen);
    seen.delete(binding); numericBindings.set(binding, result);
    return result;
  }
  function scalar(expression: Expression, parameters: Map<LexicalBinding, number>): 'number' | 'boolean' | undefined {
    const e = unparen(expression);
    if (e.kind === 'identifier') return parameters.has(owners.get(e)!) ? 'number' : undefined;
    if (e.kind === 'literal') return typeof e.value === 'number' ? 'number' : typeof e.value === 'boolean' ? 'boolean' : undefined;
    if (e.kind === 'unary') {
      const argument = scalar(e.argument, parameters);
      return e.op === '-' && argument === 'number' ? 'number' : e.op === 'not' && argument ? 'boolean' : undefined;
    }
    if (e.kind !== 'binary') return undefined;
    const left = scalar(e.left, parameters), right = scalar(e.right, parameters);
    if (left === 'number' && right === 'number') {
      if (arithmetic.has(e.op)) return 'number';
      if (comparisons.has(e.op)) return 'boolean';
    }
    return left === 'boolean' && right === 'boolean' && ['and','or','==','~='].includes(e.op) ? 'boolean' : undefined;
  }
  const sizes = new Map<Expression, number>();
  function size(expression: Expression): number {
    const e = unparen(expression), cached = sizes.get(e);
    if (cached !== undefined) return cached;
    const result = 1 + (e.kind === 'binary' ? size(e.left) + size(e.right) : e.kind === 'unary' ? size(e.argument) : 0);
    sizes.set(e, result); return result;
  }
  function target(statement: Extract<Statement,{kind:'function-decl'}>): Target | undefined {
    if (!statement.local || !statement.line || !evidence.has(statement.line) || statement.isVararg ||
        !statement.params.length || statement.params.length > 8 || statement.body.statements.length !== 1) return;
    const returns = statement.body.statements[0]!;
    if (returns.kind !== 'return' || returns.values.length !== 1) return;
    const declared = declarations.get(statement) ?? [];
    const binding = declared.find(b => b.scope !== statement.body);
    if (!binding || binding.writes.length) return;
    const parameters = new Map(declared.filter(b=>b.scope === statement.body && b.declarationIndex !== undefined)
      .map(b=>[b,b.declarationIndex!]));
    if (parameters.size !== statement.params.length || [...parameters.keys()].some(b=>b.writes.length)) return;
    const expression = returns.values[0]!;
    if (!scalar(expression, parameters) || size(expression) < 5) return;
    return {name:statement.name,expression,parameters,count:statement.params.length};
  }
  // Bound candidate/unification work independently of attacker-controlled
  // names and line metadata. Exhaustion preserves all remaining expressions.
  function same(a: Expression, b: Expression): boolean {
    if (--budget < 0) return false;
    a = unparen(a); b = unparen(b);
    if (a.kind === 'identifier' && b.kind === 'identifier') return owners.get(a) === owners.get(b);
    if (a.kind === 'literal' && b.kind === 'literal') return Object.is(a.value, b.value);
    if (a.kind === 'unary' && b.kind === 'unary') return a.op === b.op && same(a.argument,b.argument);
    return a.kind === 'binary' && b.kind === 'binary' && a.op === b.op && same(a.left,b.left) && same(a.right,b.right);
  }
  function match(pattern: Expression, value: Expression, candidate: Target, args: Map<number,Expression>): boolean {
    if (--budget < 0) return false;
    const p = unparen(pattern), v = unparen(value);
    if (p.kind === 'identifier') {
      const index = candidate.parameters.get(owners.get(p)!);
      if (index === undefined || !numeric(v)) return false;
      const prior = args.get(index);
      if (prior) return same(prior,v);
      args.set(index,v); return true;
    }
    if (p.kind === 'literal' && v.kind === 'literal') return Object.is(p.value,v.value);
    if (p.kind === 'unary' && v.kind === 'unary') return p.op === v.op && match(p.argument,v.argument,candidate,args);
    return p.kind === 'binary' && v.kind === 'binary' && p.op === v.op &&
      match(p.left,v.left,candidate,args) && match(p.right,v.right,candidate,args);
  }
  const replacements = new Map<object,object>();
  function continues(body: Block): boolean {
    return body.statements.some(s=>s.kind==='continue' || (s.kind==='do' && continues(s.body)) ||
      (s.kind==='if' && (continues(s.consequent) || s.branches.some(b=>continues(b.body)) || !!s.alternate && continues(s.alternate))));
  }
  function expression(e: Expression, available: Available): void {
    if (budget <= 0) return;
    for (const candidate of available.values()) {
      if (--budget < 0) return;
      const args = new Map<number,Expression>();
      if (match(candidate.expression,e,candidate,args) && args.size === candidate.count) {
        const ordered = Array.from({length:candidate.count},(_,i)=>args.get(i)!);
        if (size(e) >= 2 + ordered.reduce((n,arg)=>n+size(arg),0) + 2) {
          replacements.set(e,{kind:'call',callee:ident(candidate.name),args:ordered,open:false});
          return;
        }
      }
    }
    const visit = (value: Expression) => expression(value,available);
    switch(e.kind) {
      case 'binary': visit(e.left);visit(e.right);break;
      case 'unary': visit(e.argument);break;
      case 'paren': visit(e.expression);break;
      case 'call': visit(e.callee);e.args.forEach(visit);break;
      case 'method-call': visit(e.object);e.args.forEach(visit);break;
      case 'property': visit(e.object);break;
      case 'index': visit(e.table);visit(e.key);break;
      case 'table': e.fields.forEach(f=>{if(f.key)visit(f.key);visit(f.value);});break;
      case 'if-expr': visit(e.test);visit(e.consequent);e.branches.forEach(b=>{visit(b.test);visit(b.value);});visit(e.alternate);break;
      case 'interp': e.parts.forEach(p=>{if(typeof p.value!=='string')visit(p.value);});break;
      case 'function-expr': walk(e.body,new Map());break;
    }
  }
  function walk(body: Block, inherited: Available): Available {
    const available = new Map(inherited);
    const visit = (e: Expression) => expression(e,available);
    const nested = (b: Block, names: string[] = []) => {
      const scope = new Map(available); names.forEach(name=>scope.delete(name)); return walk(b,scope);
    };
    for (const s of body.statements) {
      switch(s.kind) {
        case 'function-decl': {
          walk(s.body,new Map());
          if (s.local) available.delete(s.name);
          const candidate = target(s);
          if (candidate) available.set(candidate.name,candidate);
          break;
        }
        case 'local': s.values.forEach(visit);s.names.forEach(name=>available.delete(name));break;
        case 'assign': s.targets.forEach(visit);s.values.forEach(visit);break;
        case 'compound-assign': visit(s.target);visit(s.value);break;
        case 'expression-stmt': visit(s.expression);break;
        case 'return': s.values.forEach(visit);break;
        case 'if': visit(s.test);nested(s.consequent);s.branches.forEach(b=>{visit(b.test);nested(b.body);});if(s.alternate)nested(s.alternate);break;
        case 'while': visit(s.test);nested(s.body);break;
        case 'repeat': {
          const tail = nested(s.body);
          // A continue reaches until without necessarily executing declarations
          // in this body. Nested-loop continues do not skip these declarations.
          if (continues(s.body)) for (const [name,candidate] of tail)
            if (available.get(name)!==candidate) tail.delete(name);
          expression(s.test,tail);break;
        }
        case 'numeric-for': visit(s.start);visit(s.stop);if(s.step)visit(s.step);nested(s.body,[s.name]);break;
        case 'generic-for': s.iterators.forEach(visit);nested(s.body,s.names);break;
        case 'do': nested(s.body);break;
      }
    }
    return available;
  }
  walk(ast.body,new Map());
  return replacements.size ? replaceReferences(ast,replacements) : ast;
}
