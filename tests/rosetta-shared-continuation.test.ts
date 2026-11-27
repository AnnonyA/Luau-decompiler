import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {expect, it} from 'vitest';
import type {Block, Statement} from '../src/ast/Ast.ts';
import {decompile} from '../src/decompile.ts';

type Path = {writes: number; transfer?: 'continue' | 'break' | 'return'};

// Enumerate syntactic iteration paths, respecting terminal transfers. This
// independent AST invariant detects an extra execution of the shared update.
function paths(body: Block, counter: string): Path[] {
  let result: Path[] = [{writes: 0}];
  for (const statement of body.statements) {
    const outcomes = statementPaths(statement, counter);
    result = result.flatMap(path => path.transfer ? [path] : outcomes.map(outcome => ({
      writes: path.writes + outcome.writes, transfer: outcome.transfer,
    })));
  }
  return result;
}

function statementPaths(statement: Statement, counter: string): Path[] {
  switch (statement.kind) {
    case 'if': return [statement.consequent, ...statement.branches.map(branch => branch.body),
      statement.alternate ?? {kind: 'block', statements: []} as Block].flatMap(body => paths(body, counter));
    case 'do': return paths(statement.body, counter);
    case 'continue': case 'break': case 'return': return [{writes: 0, transfer: statement.kind}];
    case 'assign': return [{writes: statement.targets.filter(target => target.kind === 'identifier' && target.name === counter).length}];
    case 'compound-assign': return [{writes: Number(statement.target.kind === 'identifier' && statement.target.name === counter)}];
    default: return [{writes: 0}];
  }
}

const fixture = (name: string) => readFileSync(new URL(`fixtures/rosetta-shared-continuation/${name}`, import.meta.url));
const manifest = JSON.parse(fixture('manifest.json').toString()) as {
  entries: Array<{profile: string; source: string; sourceSha256: string; bytecode: string; sha256: string}>;
};

for (const entry of manifest.entries) {
  it(`executes the shared cursor update once per surviving iteration at ${entry.profile}`, () => {
    const bytes = fixture(entry.bytecode);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256);
    expect(createHash('sha256').update(fixture(entry.source)).digest('hex')).toBe(entry.sourceSha256);
    const result = decompile(bytes, {opcodeEncoding: 'official'});
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.validation).toEqual([]);
    const fn = result.ast.body.statements.find(statement => statement.kind === 'function-decl');
    expect(fn?.kind).toBe('function-decl');
    if (fn?.kind !== 'function-decl') throw new Error('Missing scanner function');
    const loop = fn.body.statements.find(statement => statement.kind === 'while');
    expect(loop?.kind).toBe('while');
    if (loop?.kind !== 'while' || loop.test.kind !== 'binary' || loop.test.left.kind !== 'identifier')
      throw new Error('Missing cursor loop condition');
    const outcomes = paths(loop.body, loop.test.left.name);
    const surviving = outcomes.filter(path => path.transfer !== 'return');
    expect(surviving.length).toBeGreaterThan(0);
    expect(new Set(surviving.map(path => path.writes))).toEqual(new Set([1]));
    expect(outcomes.filter(path => path.transfer === 'return').length).toBeGreaterThan(0);
    expect(new Set(outcomes.filter(path => path.transfer === 'return').map(path => path.writes))).toEqual(new Set([0]));
  });
}
