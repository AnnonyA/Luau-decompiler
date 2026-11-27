import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {decompile} from '../src/decompile.ts';
import {analyzeBindings} from '../src/analysis/Bindings.ts';
import type {Expression} from '../src/ast/Ast.ts';
import {ident} from '../src/ast/Ast.ts';

const fixture = (name: string) => readFileSync(new URL(`fixtures/rosetta-repeat-paths/${name}`, import.meta.url));
const manifest = JSON.parse(fixture('manifest.json').toString()) as {
  entries: Array<{name: string; profile: string; source: string; sourceSha256: string; bytecode: string; sha256: string}>;
};
function nodes(value: unknown, kind: string): Record<string, any>[] {
  if (!value || typeof value !== 'object') return [];
  const node = value as Record<string, any>;
  return [...(node.kind === kind ? [node] : []), ...Object.values(node).flatMap(child => nodes(child, kind))];
}

describe('repeat tests with a short-circuit backedge', () => {
  for (const entry of manifest.entries) {
    it(`retains the sealed ${entry.name} program at ${entry.profile}`, () => {
      const bytes = fixture(entry.bytecode);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256);
      expect(createHash('sha256').update(fixture(entry.source)).digest('hex')).toBe(entry.sourceSha256);
      const result = decompile(bytes, {opcodeEncoding: 'official'});
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.error);
      expect(result.validation).toEqual([]);
      expect([...analyzeBindings(result.ast.body).globals].filter(name =>
        !['print', 'table', 'select', 'type'].includes(name))).toEqual([]);
      expect(nodes(result.ast, 'repeat').length + nodes(result.ast, 'while').length).toBeGreaterThan(0);
    });
  }

  it.each(['O0g1', 'O0g2'])('keeps the false predicate on the backedge path at %s', profile => {
    const result = decompile(fixture(`repeat-short-circuit-latch-${profile}.luauc`), {opcodeEncoding: 'official'});
    if (!result.ok) throw new Error(result.error);
    const loop = nodes(result.ast, 'repeat')[0]!;
    expect(loop.test).toEqual({kind: 'literal', value: false});
    expect(nodes(loop.body, 'continue')).toHaveLength(1);
    expect(nodes(loop.body, 'break')).toHaveLength(2);
    const guard = nodes(loop.body, 'if').find(node => nodes(node.consequent, 'continue').length);
    expect(nodes(guard?.test, 'identifier').some(node => node.name === 'type')).toBe(true);
  });

  it.each(['O0g1', 'O0g2', 'O1g1', 'O1g2'])('preserves conditional call effects and zero truthiness at %s', profile => {
    const result = decompile(fixture(`repeat-gated-call-effects-${profile}.luauc`), {opcodeEncoding: 'official'});
    if (!result.ok) throw new Error(result.error);
    const test = nodes(result.ast, 'repeat')[0]!.test as Expression;
    for (const turn of [1, 2, 4]) {
      const observed: string[] = [];
      const value = evaluateCondition(test, name => {
        if (name === 'ready') return () => { observed.push('ready'); return turn === 2; };
        if (name === 'finish') return () => { observed.push('finish'); return 0; };
        return turn;
      });
      expect(truthy(value)).toBe(turn !== 1);
      expect(observed).toEqual(turn === 1 ? ['ready'] : turn === 2 ? ['ready', 'finish'] : []);
    }
  });

  it.each([[true, false, 'firstValue'], [false, 0, 'secondValue'], [false, false, 'fallbackValue']])(
    'evaluates only the selected conditional-expression value (%s, %s)', (first, second, selected) => {
      const invoke = (name: string): Expression => ({kind: 'call', callee: ident(name), args: []});
      const expression: Expression = {
        kind: 'if-expr', test: ident('first'), consequent: invoke('firstValue'),
        branches: [{test: ident('second'), value: invoke('secondValue')}], alternate: invoke('fallbackValue'),
      };
      const observed: string[] = [];
      expect(evaluateCondition(expression, name => name === 'first' ? first : name === 'second' ? second :
        () => { observed.push(name); return name; })).toBe(selected);
      expect(observed).toEqual([selected]);
    });
});

const truthy = (value: unknown): boolean => value !== false && value !== null;
// Evaluate only the recovered scalar condition with observable mock callees.
// This checks the short-circuit contract independently of CFG reconstruction.
function evaluateCondition(expression: Expression, lookup: (name: string) => any): any {
  switch (expression.kind) {
    case 'literal': return expression.value;
    case 'identifier': return lookup(expression.name);
    case 'unary':
      if (expression.op === 'not') return !truthy(evaluateCondition(expression.argument, lookup));
      break;
    case 'call': return evaluateCondition(expression.callee, lookup)(...expression.args.map(arg => evaluateCondition(arg, lookup)));
    case 'if-expr':
      if (truthy(evaluateCondition(expression.test, lookup))) return evaluateCondition(expression.consequent, lookup);
      for (const branch of expression.branches) {
        if (truthy(evaluateCondition(branch.test, lookup))) return evaluateCondition(branch.value, lookup);
      }
      return evaluateCondition(expression.alternate, lookup);
    case 'binary': {
      const left = evaluateCondition(expression.left, lookup);
      if (expression.op === 'and') return truthy(left) ? evaluateCondition(expression.right, lookup) : left;
      if (expression.op === 'or') return truthy(left) ? left : evaluateCondition(expression.right, lookup);
      const right = evaluateCondition(expression.right, lookup);
      if (expression.op === '>=') return left >= right;
      if (expression.op === '>') return left > right;
      if (expression.op === '<=') return left <= right;
      if (expression.op === '<') return left < right;
      if (expression.op === '==') return left === right;
      if (expression.op === '~=') return left !== right;
    }
  }
  throw new Error(`Unexpected condition node ${expression.kind}`);
}
