import {describe, expect, it} from 'vitest';
import {decompile} from '../src/decompile.ts';
import {block, chunk, ident, lit, type Block, type Expression, type FunctionExpression, type Statement} from '../src/ast/Ast.ts';
import {analyzeBindings} from '../src/analysis/Bindings.ts';
import {rewriteRegisterCount} from '../src/reconstruct/RegisterBudget.ts';

// Project-authored O2/g0 program, official Luau 9d7748a4. Each H closure
// reads a global and is created before its owner changes environment. W then
// captures H. Moving H to W's recovered factory argument changes nil,nil to A,B.
const beforeEnvironment = Buffer.from('DgMHBXRva2VuAUEBQgVwcmludAJfRwdzZXRmZW52B2dldGZlbnYABhYBAAEAAAACCQAAABYAAgAAAAQAAAAAHAIBAAAIAAMTAQAARgAAABYBAgAAAQAEAAAAAAoiAQAAAAgAAwwAAQAAAABAFgACAAIDAQQAAABAAAcAAAAAASIBAAAACAADDAABAAAAAEAWAAIAAgMBBAAAAEAACwAAAAAB5wEHAAMBAAArQQAAAAkAAAAEAQEAVwACAgAAAABAAQAACQIBAAQDAQA2BAMAVwIDAQEAAABAAgQARgABAAkDAQAEBAEABgUAAFcDAwECAAAAQAEFAAkDAQAEBAEANgUHAFcDAwEDAAAAQAMEAEYAAQAJBAEABAUBAAYGAABXBAMBBAAAAAkEAgAGBQIAVwUBAgUAAABXBQECBgAAAAYGAwBXBgECBwAAABUGAQAVBAABFgABAAgGAgMBAwIIAQECAAAABgAGAwMDCAEBBgAAAAMCAAMFAAAACAADAAkAEAAWAB0AIQAjACZzBgAAAQoAE0EAAAAMAAEAAAAAQAwBAwAAACBADwEB+wQAAAAMAgMAAAAgQA8CAo8FAAAAQAMGAEAEBwBGAAIARgABAEYAAAAGBQQAFQUBARYAAQAIAwQEAAAAQAMFBAAAIEADBgMHBgEGBAIBBAEAAAAAHAU=', 'base64');

function objects(value: unknown): object[] {
  if (!value || typeof value !== 'object') return [];
  return [value, ...Object.entries(value).flatMap(([key, child]) =>
    key === 'closureIdentity' ? [] : objects(child))];
}
function immediateFunction(statement: Statement): FunctionExpression | Extract<Statement, {kind: 'function-decl'}> | undefined {
  if (statement.kind === 'function-decl') return statement;
  const value = statement.kind === 'local' ? statement.values[0] : undefined;
  return value?.kind === 'function-expr' ? value : undefined;
}
function readsToken(fn: ReturnType<typeof immediateFunction>): boolean {
  return !!fn && fn.body.statements.some(statement => statement.kind === 'return' &&
    statement.values.some(value => value.kind === 'identifier' && value.name === 'token'));
}

describe('adversarial closure inline proofs', () => {
  it('keeps native captured-constant checks across repeated host activations', () => {
    // Original O2/g0 returns true,false,false with one load and host env A/B/A.
    // The third activation has a fresh captured table, so restoring env A does
    // not restore capture equality. A first-load alias incorrectly returns TTT.
    const result = decompile(Buffer.from('DgMAAAMWAQABAAAAAgkAAAAWAAIAAAACAAAAAB0BAAEAAAADQAAAAEYCAAAWAAIAAQYAAQACAAAAAE0FAAABCgAOQQAAADUAAAAAAAAAQAEAAEYAAABAAgEARgAAAEADAQBGAAAAGwICAAMAAAADBAABAwQBABYEAgACBgEGAAIBAAEAAAAAGwI=', 'base64'), {opcodeEncoding: 'official', runtimeContext: false});
    expect(result.ok).toBe(true);
    if (!result.ok) throw Error(result.error);
    expect(result.diagnostics.filter(d => d.code === 'closure-identity-entry-assumption')).toEqual([]);
    const factories = result.ast.body.statements.filter((statement): statement is Extract<Statement, {kind: 'function-decl'}> =>
      statement.kind === 'function-decl' && statement.local && statement.params.length === 0 &&
      statement.body.statements.some(child => child.kind === 'return' && child.values[0]?.kind === 'function-expr'));
    const calls = objects(result.ast).filter(value => (value as Expression).kind === 'call') as Extract<Expression, {kind: 'call'}>[];
    expect(factories.some(factory => calls.filter(call => call.callee.kind === 'identifier' &&
      call.callee.name === factory.name).length === 2)).toBe(true);
  });

  it('rejects right-nested binary pressure before certifying native helper inlining', () => {
    // Official O2 on this expression uses R161..R163 and rejects bind's
    // inline due to high register pressure. The previous pack-only budget
    // counted 14, even though all 80 left call results remain live.
    const call = (callee: Expression, args: Expression[] = []): Expression =>
      ({kind: 'call', callee, args, open: false});
    const fn = (params: string[], value: Expression, isVararg = false): FunctionExpression =>
      ({kind: 'function-expr', params, isVararg, body: block([{kind: 'return', values: [value]}])});
    let expression = call(call(call(ident('bind'), [ident('a')])));
    for (let i = 0; i < 80; i++) expression = {kind: 'binary', op: '+', left: call(ident('g')), right: expression};
    const ast = chunk([
      {kind: 'local', names: ['a'], values: [fn([], lit(1))]},
      {kind: 'local', names: ['bind'], values: [fn(['p'], fn([], ident('p')))]},
      {kind: 'local', names: ['g'], values: [fn([], lit(0), true)]},
      {kind: 'local', names: ['result'], values: [expression]},
      {kind: 'expression-stmt', expression: call(ident('print'), [ident('result')])},
    ]);
    const bound = rewriteRegisterCount(analyzeBindings(ast.body).bindings, ast.body);
    expect(bound + 10).toBeGreaterThan(96);
  });

  it('preserves capture initializers before owner environment changes through the complete pipeline', () => {
    const result = decompile(beforeEnvironment, {opcodeEncoding: 'official', runtimeContext: false});
    expect(result.ok).toBe(true);
    if (!result.ok) throw Error(result.error);
    expect(result.diagnostics.some(d => d.code === 'closure-identity-native-inline')).toBe(true);
    const owner = objects(result.ast).find(value => {
      const fn = value as FunctionExpression;
      return fn.kind === 'function-expr' && fn.isVararg && fn.body.statements.some(statement =>
        statement.kind === 'function-decl' && statement.name.startsWith('closureFactory'));
    }) as FunctionExpression;
    expect(owner).toBeDefined();
    const statements: Block['statements'] = owner.body.statements;
    const initializers = statements.flatMap((statement, index) => readsToken(immediateFunction(statement)) ? [index] : []);
    const changes = statements.flatMap((statement, index) => objects(statement).some(value => {
      const field = value as {name?: string; value?: {kind?: string; value?: unknown}};
      return field.name === 'token' && field.value?.kind === 'literal' &&
        (field.value.value === 'A' || field.value.value === 'B');
    }) ? [index] : []);
    expect(initializers).toHaveLength(2);
    expect(changes).toHaveLength(2);
    expect(initializers[0]!).toBeLessThan(changes[0]!);
    expect(initializers[1]!).toBeLessThan(changes[1]!);
  });
});
