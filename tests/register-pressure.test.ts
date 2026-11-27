import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {describe, expect, it} from 'vitest';
import {block, chunk, ident, lit, type Block, type Chunk, type Statement} from '../src/ast/Ast.ts';
import {analyzeBindings} from '../src/analysis/Bindings.ts';
import {boundLocalLifetimes} from '../src/reconstruct/LocalLifetimes.ts';
import {decompile} from '../src/decompile.ts';

const padding = (): Statement[] => Array.from({length: 128}, (_, index) => ({
  kind: 'local', names: [`padding${index}`], values: [lit(index)],
}));
const tuple = (): Statement => ({
  kind: 'local', names: ['temporary', 'middle', 'tail'],
  values: [{kind: 'call', callee: ident('produce'), args: [ident('counter')], open: true}],
  types: [undefined, 'nil', undefined],
});
const alias = (name = 'counter'): Statement => ({kind: 'local', names: [name], values: [ident('temporary')], types: ['number']});
const pressured = (statements: Statement[]): Chunk => chunk([...padding(), ...statements]);
const slot = (ast: Chunk, name: string) => analyzeBindings(ast.body).bindings.find(binding =>
  binding.name === name && binding.declaration.kind === 'local' && binding.declaration.names.length === 3);

describe('fixed call tuple aliases under local pressure', () => {
  it('keeps the destination cell, fixed tuple arity, annotations and initializer scope', () => {
    const producer = tuple();
    const input = pressured([
      producer, alias(),
      {kind: 'function-decl', name: 'read', local: true, params: [], isVararg: false,
        body: block([{kind: 'return', values: [ident('counter'), ident('middle'), ident('tail')]}])},
      {kind: 'compound-assign', target: ident('counter'), op: '+', value: lit(1)},
      {kind: 'return', values: [ident('read')]},
    ]);
    const result = boundLocalLifetimes(input, {foldSingleUseTemps: false});
    const destination = slot(result, 'counter');
    expect(destination).toBeDefined();
    expect(destination!.captured).toBe(true);
    expect(destination!.writes).toHaveLength(1);
    expect(slot(result, 'temporary')).toBeUndefined();
    expect(destination!.declaration).toMatchObject({
      names: ['counter', 'middle', 'tail'], types: ['number', 'nil', undefined],
      values: producer.kind === 'local' ? producer.values : [],
    });
    // The call's counter argument still reads the previous scope. No identifier
    // inside the initializer was captured by moving the destination declaration.
    expect([...analyzeBindings(result.body).globals].sort()).toEqual(['counter', 'produce']);
    expect(input.body.statements).toContain(producer);
    expect(producer.kind === 'local' && producer.names[0]).toBe('temporary');
  });

  it('coalesces consecutive copies of different slots without dropping a nil result', () => {
    const result = boundLocalLifetimes(pressured([
      tuple(), alias(), {kind: 'local', names: ['last'], values: [ident('tail')]},
      {kind: 'return', values: [ident('counter'), ident('middle'), ident('last')]},
    ]));
    const destination = slot(result, 'counter');
    expect(destination!.declaration).toMatchObject({names: ['counter', 'middle', 'last']});
    expect(analyzeBindings(result.body).bindings.filter(binding => ['counter', 'middle', 'last'].includes(binding.name))).toHaveLength(3);
  });

  it.each(['read', 'write', 'capture', 'intervening-effect', 'sibling-name'] as const)(
    'retains the original slot when the alias has a %s hazard', hazard => {
      const suffix: Statement[] = hazard === 'write'
        ? [{kind: 'assign', targets: [ident('temporary')], values: [lit(7)]}]
        : hazard === 'capture'
          ? [{kind: 'function-decl', name: 'saved', local: true, params: [], isVararg: false,
              body: block([{kind: 'return', values: [ident('temporary')]}])}]
          : [];
      const input = pressured([
        tuple(),
        ...(hazard === 'intervening-effect' ? [{kind: 'expression-stmt', expression: {kind: 'call', callee: ident('effect'), args: [], open: false}} as Statement] : []),
        alias(hazard === 'sibling-name' ? 'middle' : 'counter'),
        ...suffix,
        {kind: 'return', values: [ident('counter'), ...(hazard === 'read' ? [ident('temporary')] : [])]},
      ]);
      expect(slot(boundLocalLifetimes(input), 'temporary')).toBeDefined();
    },
  );

  it('does not replace a literal function initializer and change its observable debug name', () => {
    const result = boundLocalLifetimes(pressured([
      {kind: 'local', names: ['temporary', 'middle', 'tail'], values: [{kind: 'function-expr', params: [], isVararg: false, body: block([])}]},
      alias(), {kind: 'return', values: [ident('counter')]},
    ]));
    expect(slot(result, 'temporary')).toBeDefined();
  });
});

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

const manifest = JSON.parse(readFileSync(new URL('./fixtures/register-pressure/manifest.json', import.meta.url), 'utf8')) as {
  entries: Array<{profile: string; source: string; sourceSha256: string; bytecode: string; sha256: string}>;
};
for (const entry of manifest.entries) {
  it(`keeps the sealed wide-call-results program within Luau's active-local limit at ${entry.profile}`, () => {
    const bytes = readFileSync(new URL(`./fixtures/register-pressure/${entry.bytecode}`, import.meta.url));
    const source = readFileSync(new URL(`./fixtures/register-pressure/${entry.source}`, import.meta.url));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256);
    expect(createHash('sha256').update(source).digest('hex')).toBe(entry.sourceSha256);
    const result = decompile(bytes, {opcodeEncoding: 'official'});
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.validation).toEqual([]);
    const function_ = result.ast.body.statements.find(statement => statement.kind === 'function-decl' && statement.name === 'inspectWide');
    expect(function_?.kind).toBe('function-decl');
    if (!function_ || function_.kind !== 'function-decl') throw new Error('wide function missing');
    expect(activeLocals(function_.body, function_.params.length)).toBeLessThanOrEqual(200);
    expect([...analyzeBindings(result.ast.body).globals].sort()).toEqual(['print', 'select', 'table']);
  });
}
