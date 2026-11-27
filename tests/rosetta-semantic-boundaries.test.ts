import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {analyzeBindings} from '../src/analysis/Bindings.ts';
import {decompile} from '../src/decompile.ts';
import {isValidIdentifier} from '../src/reconstruct/Naming.ts';

const profiles = [0, 1, 2].flatMap(opt => [1, 2].map(debug => `O${opt}g${debug}`));
const names = [
  'method-result-call', 'materialized-list-writes', 'constructor-before-return',
  'contextual-continue', 'conditional-method-calls', 'comparison-selected-values',
  'sequential-phi-ranges', 'captured-table-reset', 'shared-nested-phis', 'empty-constructor-key',
  'computed-loop-update', 'guard-constructor-operands', 'compound-guard-return',
];
const fixture = (name: string, profile: string) => readFileSync(new URL(
  `fixtures/rosetta-semantics/${name}-${profile}.luauc`, import.meta.url));

function nodes(value: unknown, kind: string): any[] {
  if (!value || typeof value !== 'object') return [];
  const node = value as Record<string, unknown>;
  return [...(node.kind === kind ? [node] : []), ...Object.values(node).flatMap(child => nodes(child, kind))];
}

describe('call, constructor and contextual identifier boundaries', () => {
  it.each(profiles)('keeps all compiled regressions representable at %s', profile => {
    for (const name of names) {
      const result = decompile(fixture(name, profile), {opcodeEncoding: 'official'});
      expect(result.ok, name).toBe(true);
      if (!result.ok) throw new Error(result.error);
      expect(result.validation, name).toEqual([]);
      for (const block of nodes(result.ast, 'block')) {
        const terminal = block.statements.findIndex((statement: any) => statement.kind === 'return');
        expect(terminal === -1 || terminal === block.statements.length - 1, name).toBe(true);
      }
    }
  });

  it.each(profiles)('calls the function returned by a method at %s', profile => {
    const result = decompile(fixture('method-result-call', profile));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    const nested = nodes(result.ast, 'call').find(call => call.callee.kind === 'method-call');
    expect(nested).toBeDefined();
    expect(nested.callee.name).toBe('factory');
    expect(nested.callee.args).toEqual([{kind: 'literal', value: 3}]);
    expect(nested.args).toEqual([
      {kind: 'literal', value: 4}, {kind: 'literal', value: 5}, {kind: 'literal', value: null},
    ]);
  });

  it('updates the same materialized constructor when SETLIST arrives later', () => {
    const result = decompile(fixture('materialized-list-writes', 'O0g1'));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    const write = nodes(result.ast, 'assign').find(assignment => assignment.targets.length === 2 &&
      assignment.targets.every((target: any) => target.kind === 'index'));
    expect(write).toBeDefined();
    expect(write.targets.map((target: any) => target.key)).toEqual([
      {kind: 'literal', value: 1}, {kind: 'literal', value: 2},
    ]);
    expect(write.targets[0].table).toEqual(write.targets[1].table);
    expect(write.values).toEqual([{kind: 'literal', value: 'alpha'}, {kind: 'literal', value: 'omega'}]);
    const name = write.targets[0].table.name;
    expect(nodes(result.ast, 'local').some(local => local.names.includes(name) &&
      local.values.some((value: any) => value.kind === 'table' && value.fields.some((field: any) =>
        field.value.kind === 'literal' && field.value.value === 17)))).toBe(true);
  });

  it('accepts continue where the parser accepts an identifier', () => {
    expect(isValidIdentifier('continue')).toBe(true);
    expect(isValidIdentifier('return')).toBe(false);
    const result = decompile(fixture('contextual-continue', 'O1g1'));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.validation).toEqual([]);
    expect(result.source).toContain('continue = 6');
    expect(result.source).toContain(':continue(5)');
  });

  it.each(profiles)('retains implicit self through speculative conditional arms at %s', profile => {
    const result = decompile(fixture('conditional-method-calls', profile));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    const methods = nodes(result.ast, 'method-call');
    expect(methods.filter(call => call.name === 'read').every(call => call.args.length === 1)).toBe(true);
    expect(methods.filter(call => call.name === 'format').every(call => call.args.length === 1)).toBe(true);
    expect(nodes(result.ast, 'call').filter(call => call.callee.kind === 'method-call')).toEqual([]);
  });

  it.each(profiles)('retains comparisons when one selected value is the tested register at %s', profile => {
    const result = decompile(fixture('comparison-selected-values', profile));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    const loop = nodes(result.ast, 'numeric-for')[0];
    expect(loop).toBeDefined();
    for (const bound of [loop.start, loop.stop]) {
      expect(nodes(bound, 'binary').some(expression => expression.op === '<')).toBe(true);
    }
  });

  it.each(profiles)('keeps an earlier selected value across a second join in the same register at %s', profile => {
    const result = decompile(fixture('sequential-phi-ranges', profile));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    const returned = nodes(result.ast, 'return').find(statement => statement.values.length === 2);
    expect(returned).toBeDefined();
    expect(returned.values[0]).not.toEqual(returned.values[1]);
  });

  it.each(['O0g1', 'O0g2', 'O1g1', 'O1g2'])('updates the captured table before its observer runs at %s', profile => {
    const result = decompile(fixture('captured-table-reset', profile));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    const statements = result.ast.body.statements;
    const resets = statements.flatMap((statement, index) => statement.kind === 'assign' &&
      statement.values[0]?.kind === 'table' ? [{statement, index}] : []);
    expect(resets).toHaveLength(2);
    expect(resets[0]!.statement.targets).toEqual(resets[1]!.statement.targets);
    const observations = statements.flatMap((statement, index) => statement.kind === 'local' &&
      nodes(statement, 'call').some(call => nodes(call.callee, 'identifier').some(id => id.name === 'observe')) ? [index] : []);
    expect(observations).toHaveLength(2);
    expect(resets[0]!.index).toBeLessThan(observations[0]!);
    expect(observations[0]!).toBeLessThan(resets[1]!.index);
    expect(resets[1]!.index).toBeLessThan(observations[1]!);
  });

  it.each(profiles)('declares nested join variables in each emitted alternative at %s', profile => {
    const result = decompile(fixture('shared-nested-phis', profile));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect([...analyzeBindings(result.ast.body).globals].sort()).toEqual(['print']);
  });

  it.each(profiles)('retains an empty string field in its pending constructor at %s', profile => {
    const result = decompile(fixture('empty-constructor-key', profile));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    const fields = nodes(result.ast, 'table').flatMap(table => table.fields);
    expect(fields.filter(field => field.key?.kind === 'literal' && field.key.value === '')).toHaveLength(1);
  });

  it.each(profiles)('keeps an accumulator update that reads its old value through SSA temporaries at %s', profile => {
    const result = decompile(fixture('computed-loop-update', profile));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect([...analyzeBindings(result.ast.body).globals].sort()).toEqual(['print']);
  });

  it.each(profiles)('keeps child constructors in a selected-value guard prelude at %s', profile => {
    const result = decompile(fixture('guard-constructor-operands', profile));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    const tables = nodes(result.ast, 'table');
    const first = tables.find(table => table.fields.some((field: any) =>
      field.key?.kind === 'literal' && field.key.value === '' && field.value.value === 'marker'));
    expect(first).toBeDefined();
    const locals = new Map(nodes(result.ast, 'local').flatMap(local =>
      local.names.map((name: string, index: number) => [name, local.values[index]])));
    const operand = first.fields[1].value;
    const child = operand.kind === 'identifier' ? locals.get(operand.name) : operand;
    expect(child?.kind).toBe('table');
    expect(child.fields.map((field: any) => field.value)).toEqual([
      {kind: 'literal', value: 4}, {kind: 'literal', value: 'child'},
    ]);
  });

  it.each(profiles)('keeps a shared early return conditional inside its loop at %s', profile => {
    const result = decompile(fixture('compound-guard-return', profile));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    const loops = nodes(result.ast, 'while');
    expect(loops).toHaveLength(1);
    expect(loops[0].body.statements.some((statement: any) => statement.kind === 'return')).toBe(false);
    expect(nodes(loops[0], 'return').length).toBeGreaterThan(0);
  });
});
