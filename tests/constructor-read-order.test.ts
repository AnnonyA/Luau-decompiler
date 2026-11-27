import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {expect, it} from 'vitest';
import type {Expression} from '../src/ast/Ast.ts';
import {decompile} from '../src/decompile.ts';

const fixture = (name: string) => readFileSync(new URL(`fixtures/constructor-read-order/${name}`, import.meta.url));
const manifest = JSON.parse(fixture('manifest.json').toString()) as {
  entries: Array<{profile: string; source: string; sourceSha256: string; bytecode: string; sha256: string}>;
};

for (const entry of manifest.entries) {
  it(`keeps list reads on their original side of a captured mutation at ${entry.profile}`, () => {
    const bytes = fixture(entry.bytecode);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256);
    expect(createHash('sha256').update(fixture(entry.source)).digest('hex')).toBe(entry.sourceSha256);
    const result = decompile(bytes, {opcodeEncoding: 'official'});
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.validation).toEqual([]);
    // O2 may inline the mutation. The sealed official VM runs also cover it;
    // this scalar observation oracle targets the O0/O1 regression directly.
    if (entry.profile.startsWith('O2')) return;
    const advance = result.ast.body.statements.find(statement =>
      statement.kind === 'function-decl' && statement.name === 'advance');
    if (advance?.kind !== 'function-decl') throw new Error('Missing advancing closure');
    const mutation = advance.body.statements.find(statement => statement.kind === 'compound-assign');
    if (mutation?.kind !== 'compound-assign' || mutation.target.kind !== 'identifier')
      throw new Error('Missing captured cell update');
    const cell = mutation.target.name;
    const env = new Map<string, any>();
    env.set(advance.name, (amount: number) => {
      const value = env.get(cell) + amount;
      env.set(cell, value);
      return value;
    });
    let observed: unknown[] | undefined;
    const evaluate = (expression: Expression): any => {
      switch (expression.kind) {
        case 'literal': return expression.value;
        case 'identifier': return env.get(expression.name);
        case 'paren': return evaluate(expression.expression);
        case 'if-expr': {
          const truthy = (value: any) => value !== null && value !== false;
          if (truthy(evaluate(expression.test))) return evaluate(expression.consequent);
          for (const branch of expression.branches) if (truthy(evaluate(branch.test))) return evaluate(branch.value);
          return evaluate(expression.alternate);
        }
        case 'call': {
          const callee = evaluate(expression.callee), args = expression.args.map(evaluate);
          return typeof callee === 'function' ? callee(...args) : undefined;
        }
        case 'table': {
          const values = expression.fields.map(field => evaluate(field.value));
          if (!observed && values.length === 3 && expression.fields.every(field => !field.name && !field.key))
            observed = values;
          return values;
        }
        default: throw new Error(`Unexpected prefix expression ${expression.kind}`);
      }
    };
    for (const statement of result.ast.body.statements) {
      if (statement.kind === 'local') {
        const values = statement.values.map(evaluate);
        statement.names.forEach((name, index) => env.set(name, values[index]));
      }
      if (observed) break;
    }
    expect(observed).toEqual([10, 12, 12]);
  });
}
