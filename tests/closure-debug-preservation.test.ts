import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {expect, it} from 'vitest';
import {block, chunk, ident, lit, type FunctionExpression} from '../src/ast/Ast.ts';
import {namedClosureDeclaration} from '../src/reconstruct/ClosureNames.ts';
import {analyzeBindings} from '../src/analysis/Bindings.ts';
import {decompile} from '../src/decompile.ts';

it('names a closure in its existing frame without a table or another literal', () => {
  const fn: FunctionExpression = {kind: 'function-expr', debugName: 'tag', params: [], isVararg: false,
    body: block([{kind: 'return', values: [lit(91)]}]), creationSite: {ownerProtoId: 1, pc: 4},
    closureIdentity: {ownerProtoId: 1, constantIndex: 0, childProtoId: 2, pc: 4, captureCount: 0}};
  const original = structuredClone(fn), declaration = namedClosureDeclaration(fn)!;
  expect(fn).toEqual(original);
  expect(declaration).toMatchObject({kind: 'function-decl', name: 'tag', local: true,
    body: fn.body, creationSite: fn.creationSite, closureIdentity: fn.closureIdentity});
  const {bindings, globals} = analyzeBindings(block([declaration, {kind: 'return', values: [ident('tag')]}]));
  expect(globals.size).toBe(0);
  expect(bindings).toHaveLength(1);
  expect(bindings[0]!.captured).toBe(false);
  expect(bindings[0]!.reads).toHaveLength(1);
});
it('refuses to bind a same-named free global', () => {
  const fn: FunctionExpression = {kind: 'function-expr', debugName: 'tag', params: [], isVararg: false,
    body: block([{kind: 'return', values: [ident('tag')]}])};
  expect(namedClosureDeclaration(fn)).toBeUndefined();
});
it('refuses to capture a same-named outer cell as a recursive self binding', () => {
  const fn: FunctionExpression = {kind: 'function-expr', debugName: 'tag', params: [], isVararg: false,
    body: block([{kind: 'return', values: [ident('tag')]}])};
  expect(namedClosureDeclaration(fn)).toBeUndefined();
  const ast = chunk([{kind: 'local', names: ['tag'], values: [lit('outer')]}, {kind: 'return', values: [fn]}]);
  const {bindings, globals} = analyzeBindings(ast.body);
  expect(globals.size).toBe(0);
  expect(bindings).toHaveLength(1);
  expect(bindings[0]!.captured).toBe(true);
  expect(bindings[0]!.reads).toHaveLength(1);
});
it('does not invent a name for an anonymous closure', () => {
  const fn: FunctionExpression = {kind: 'function-expr', params: [], isVararg: false, body: block()};
  expect(namedClosureDeclaration(fn)).toBeUndefined();
});
it('checks same-named free bindings in descendant closures', () => {
  const child: FunctionExpression = {kind: 'function-expr', params: [], isVararg: false,
    body: block([{kind: 'return', values: [ident('tag')]}])};
  const fn: FunctionExpression = {kind: 'function-expr', debugName: 'tag', params: [], isVararg: false,
    body: block([{kind: 'return', values: [child]}])};
  expect(namedClosureDeclaration(fn)).toBeUndefined();
  expect(namedClosureDeclaration({...fn, params: ['tag']})).toBeDefined();
});
it('distinguishes a shadowing local from its initializer and earlier reads', () => {
  const fn: FunctionExpression = {kind: 'function-expr', debugName: 'tag', params: [], isVararg: false,
    body: block([{kind: 'local', names: ['tag'], values: [lit(1)]}, {kind: 'return', values: [ident('tag')]}])};
  expect(namedClosureDeclaration(fn)).toBeDefined();
  expect(namedClosureDeclaration({...fn, body: block([
    {kind: 'local', names: ['tag'], values: [ident('tag')]}, {kind: 'return', values: [ident('tag')]},
  ])})).toBeUndefined();
});
const root = new URL('./fixtures/closure-debug-preservation/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', root), 'utf8')) as {
  sources: Array<{path: string; sha256: string}>;
  inputs: Array<{path: string; profile: string; pin: string; sha256: string}>;
};
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
// These assertions cover sealing, aliases and lexical references. The native
// report separately records eight pending homonymous-global name failures.
for (const input of manifest.inputs) it(`retains a sealed alias binding at ${input.pin}/${input.profile}`, () => {
  for (const source of manifest.sources) expect(hash(readFileSync(new URL(source.path, root)))).toBe(source.sha256);
  const bytes = readFileSync(new URL(input.path, root));
  expect(hash(bytes)).toBe(input.sha256);
  const result = decompile(bytes, {opcodeEncoding: 'official', runtimeContext: false});
  if (!result.ok) throw Error(result.error);
  expect(result.validation).toEqual([]);
  expect(result.diagnostics.filter(item => item.severity === 'error')).toEqual([]);
  expect(result.source).toContain('local function original(');
  expect(result.source).toMatch(/renamed = original/);
  expect([...analyzeBindings(result.ast.body).globals].sort()).toEqual(['debug', 'print', 'tag']);
});
