import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {block, chunk, ident, lit} from '../src/ast/Ast.ts';
import {cleanupAst} from '../src/ast/AstCleanup.ts';
import {analyzeBindings} from '../src/analysis/Bindings.ts';
import {repairUndeclaredAutoLocals} from '../src/reconstruct/NameInference.ts';
import {decompile} from '../src/decompile.ts';

describe('global names that resemble reconstruction temporaries', () => {
  it.each(['index', 'value', 'result', 'count'])('keeps writes to global %s while retaining a similarly named captured local', name => {
    const local = `${name}2`;
    const input = chunk([
      {kind: 'local', names: [local], values: [lit(0)]},
      {kind: 'function-decl', name: 'update', local: true, params: [], isVararg: false, body: block([
        {kind: 'assign', targets: [ident(name)], values: [lit(7)]},
        {kind: 'assign', targets: [ident(local)], values: [{kind: 'binary', op: '+', left: ident(local), right: lit(1)}]},
        {kind: 'return', values: [ident(name), lit(null), ident(local)]},
      ])},
      {kind: 'return', values: [ident('update')]},
    ]);
    const result = cleanupAst(input, {
      typeAnnotations: 'off', ifExpressions: false, earlyReturn: false,
      interpolatedStrings: false, mathConstants: false, foldSingleUseTemps: false,
      workingNames: new Set([local, 'update']),
    });
    const analysis = analyzeBindings(result.body);
    expect(analysis.globals).toEqual(new Set([name]));
    expect(analysis.bindings.some(binding => binding.name === name)).toBe(false);
    const captured = analysis.bindings.find(binding => binding.captured);
    expect(captured?.writes).toHaveLength(1);
    expect(captured?.declaration.kind).toBe('local');
  });

  it('repairs an allocated temporary without localizing the global with the same stem', () => {
    const result = repairUndeclaredAutoLocals(chunk([
      {kind: 'assign', targets: [ident('index')], values: [lit(3)]},
      {kind: 'assign', targets: [ident('index2')], values: [ident('index')]},
      {kind: 'return', values: [ident('index2'), ident('index')]},
    ]), new Set(['index2']));
    expect(result.body.statements[0]?.kind).toBe('assign');
    expect(result.body.statements[1]).toMatchObject({kind: 'local', names: ['index2']});
    expect(analyzeBindings(result.body).globals).toEqual(new Set(['index']));
  });

  it('treats an explicitly empty provenance set as no generated bindings', () => {
    const result = repairUndeclaredAutoLocals(chunk([
      {kind: 'assign', targets: [ident('result27')], values: [lit(5)]},
    ]), new Set());
    expect(result.body.statements[0]?.kind).toBe('assign');
    expect(analyzeBindings(result.body).globals).toEqual(new Set(['result27']));
  });
});

const fixture = (name: string) => readFileSync(new URL(`fixtures/rosetta-global-provenance/${name}`, import.meta.url));
const manifest = JSON.parse(fixture('manifest.json').toString()) as {
  entries: Array<{profile: string; source: string; sourceSha256: string; bytecode: string; sha256: string}>;
};
for (const entry of manifest.entries) {
  it(`preserves the sealed global-loop-choice environment writes at ${entry.profile}`, () => {
    const bytes = fixture(entry.bytecode);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256);
    expect(createHash('sha256').update(fixture(entry.source)).digest('hex')).toBe(entry.sourceSha256);
    const result = decompile(bytes, {opcodeEncoding: 'official'});
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.validation).toEqual([]);
    const analysis = analyzeBindings(result.ast.body);
    expect(analysis.globals).toEqual(new Set(['ipairs', 'index', 'table', 'tostring', 'print', 'select']));
    expect(analysis.bindings.some(binding => binding.name === 'index')).toBe(false);
  });
}
