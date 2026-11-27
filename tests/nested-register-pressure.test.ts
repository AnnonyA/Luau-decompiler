import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {analyzeBindings} from '../src/analysis/Bindings.ts';
import {block, chunk, ident, lit, type Block, type Expression, type Statement} from '../src/ast/Ast.ts';
import {decompile} from '../src/decompile.ts';
import {boundLocalLifetimes} from '../src/reconstruct/LocalLifetimes.ts';

const profiles = ['O0g1', 'O1g1', 'O2g1', 'O0g2', 'O1g2', 'O2g2',
  'O0g1+x1', 'O1g1+x2', 'O2g1+x3', 'O0g2+x2', 'O1g2+x3', 'O2g2+x1'];

function activeLocals(body: Block, inherited = 0): number {
  let active = inherited, peak = active;
  for (const statement of body.statements) {
    if (statement.kind === 'local') active += statement.names.length;
    else if (statement.kind === 'function-decl' && statement.local) active++;
    peak = Math.max(peak, active);
    if (statement.kind === 'do' || statement.kind === 'while' || statement.kind === 'repeat') peak = Math.max(peak, activeLocals(statement.body, active));
    else if (statement.kind === 'numeric-for') peak = Math.max(peak, activeLocals(statement.body, active + 1));
    else if (statement.kind === 'generic-for') peak = Math.max(peak, activeLocals(statement.body, active + statement.names.length));
    else if (statement.kind === 'if') {
      for (const child of [statement.consequent, ...statement.branches.map(branch => branch.body), ...(statement.alternate ? [statement.alternate] : [])]) {
        peak = Math.max(peak, activeLocals(child, active));
      }
    }
  }
  return peak;
}

describe('nested local budgets', () => {
  it.each(profiles)('counts parent locals inside generated scopes at %s', profile => {
    const result = decompile(readFileSync(new URL(`fixtures/rosetta-semantics/nested-register-pressure-${profile}.luauc`, import.meta.url)), {opcodeEncoding: 'official'});
    if (!result.ok) throw new Error(result.error);
    expect(result.validation).toEqual([]);
    const function_ = result.ast.body.statements.find(statement => statement.kind === 'function-decl' && statement.name === 'stress');
    if (!function_ || function_.kind !== 'function-decl') throw new Error('stress function missing');
    expect(activeLocals(function_.body, function_.params.length)).toBeLessThanOrEqual(200);
    expect([...analyzeBindings(result.ast.body).globals]).toEqual(['print']);
  });
});

const call = (name: string): Expression => ({kind: 'call', callee: ident(name), args: [], open: true});
const pressured = (statements: Statement[]) => chunk([
  ...Array.from({length: 128}, (_, index): Statement => ({kind: 'local', names: [`padding${index}`], values: [lit(index)]})),
  ...statements,
]);
const local = (name: string, value: Expression): Statement => ({kind: 'local', names: [name], values: [value]});

it('retains the original call order and scalar context in an adjacent first operand', () => {
  const result = boundLocalLifetimes(pressured([
    local('first', call('produce')),
    local('result', {kind: 'binary', op: '+', left: ident('first'), right: call('later')}),
    {kind: 'return', values: [ident('result')]},
  ]), {foldSingleUseTemps: false});
  const bindings = analyzeBindings(result.body).bindings;
  expect(bindings.some(binding => binding.name === 'first')).toBe(false);
  expect(bindings.find(binding => binding.name === 'result')?.declaration).toMatchObject({
    values: [{kind: 'binary', op: '+', left: call('produce'), right: call('later')}],
  });
});

it('does not move a saved right operand after a new left-hand effect', () => {
  const result = boundLocalLifetimes(pressured([
    local('saved', call('first')),
    local('result', {kind: 'binary', op: '+', left: call('later'), right: ident('saved')}),
    {kind: 'return', values: [ident('result')]},
  ]));
  const saved = analyzeBindings(result.body).bindings.find(binding => binding.name === 'saved');
  expect(saved?.declaration).toMatchObject({kind: 'local', values: [call('first')]});
  expect(saved?.reads).toHaveLength(1);
});

it.each(['capture', 'write'] as const)('preserves a scalar cell with an observable %s', hazard => {
  const result = boundLocalLifetimes(pressured([
    local('saved', call('produce')),
    local('result', {kind: 'unary', op: '-', argument: ident('saved')}),
    ...(hazard === 'capture' ? [{kind: 'function-decl', local: true, name: 'reader', params: [], isVararg: false,
      body: block([{kind: 'return', values: [ident('saved')]}])} as Statement]
      : [{kind: 'assign', targets: [ident('saved')], values: [lit(7)]} as Statement]),
    {kind: 'return', values: [ident('result'), ident(hazard === 'capture' ? 'reader' : 'saved')]},
  ]));
  const binding = analyzeBindings(result.body).bindings.find(binding => binding.name === 'saved');
  expect(binding).toBeDefined();
  if (hazard === 'capture') expect(binding?.captured).toBe(true);
  else expect(binding?.writes).toHaveLength(1);
});
