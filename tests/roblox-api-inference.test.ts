import { expect, it } from 'vitest';
import { block, chunk, ident, lit, type Expression, type Statement } from '../src/ast/Ast.js';
import { printLuau } from '../src/print/LuauPrinter.js';
import { recoverFunctionEvidence } from '../src/reconstruct/FunctionEvidence.js';

const prop = (object: Expression, name: string): Expression => ({kind: 'property', object, name});
const call = (callee: Expression, ...args: Expression[]): Expression => ({kind: 'call', callee, args, open: false});
const method = (object: Expression, name: string, ...args: Expression[]): Expression => ({kind: 'method-call', object, name, args, open: false});
const local = (name: string, expression: Expression): Statement => ({kind: 'local', names: [name], values: [expression]});
const assign = (target: Expression, value: Expression): Statement => ({kind: 'assign', targets: [target], values: [value]});
const source = (...stmts: Statement[]) => printLuau(recoverFunctionEvidence(chunk(stmts)));

it('recognizes constructible classes and fixed-arity calls on inherited methods', () => {
  const output = source(local('item', call(prop(ident('Instance'), 'new'), lit('Part'))),
    local('yes', method(ident('item'), 'IsA', lit('Instance'))),
    local('wrongArity', method(ident('item'), 'IsA')),
    local('service', call(prop(ident('Instance'), 'new'), lit('Players'))));
  expect(output).toContain('local item: Part');
  expect(output).toContain('local yes: boolean');
  expect(output).toContain('local wrongArity =');
  expect(output).toContain('local service =');
});

it('invalidates a builtin after writing a constructor through an alias', () => {
  const output = source(local('factory', ident('Instance')),
    assign(prop(ident('factory'), 'new'), ident('external')),
    local('item', call(prop(ident('Instance'), 'new'), lit('Part'))));
  expect(output).toContain('local item =');
});

it('uses only declared enum items on an unshadowed Enum namespace', () => {
  const item = (name: string) => prop(prop(ident('Enum'), 'KeyCode'), name);
  const output = source(local('valid', item('Space')), local('invalid', item('NoSuchKey')),
    local('Enum', ident('replacement')), local('shadowed', item('Space')));
  expect(output).toContain('local valid: Enum.KeyCode');
  expect(output).toContain('local invalid =');
  expect(output).toContain('local shadowed =');
});

it('uses the inherited WaitForChild guarantee only when timeout is absent', () => {
  const output = source(local('folder', method(ident('workspace'), 'WaitForChild', lit('Props'))),
    local('maybe', method(ident('workspace'), 'WaitForChild', lit('Props'), lit(0))));
  expect(output).toContain('local folder: Instance =');
  expect(output).not.toContain('local maybe: Instance =');
});

it('keeps a nullable receiver optional while inferring a successful read', () => {
  const output = source(local('parent', prop(ident('workspace'), 'Parent')),
    local('name', prop(ident('parent'), 'Name')));
  expect(output).toContain('local parent: Instance?');
  expect(output).toContain('local name: string');
});

it('annotates the fixed prefix of a vararg remote callback', () => {
  const listener: Expression = {kind:'function-expr', params:['sender'], isVararg:true, body:block([])};
  const output = source(local('remote', call(prop(ident('Instance'), 'new'), lit('RemoteEvent'))),
    {kind:'expression-stmt', expression:method(prop(ident('remote'), 'OnServerEvent'), 'Connect', listener)});
  expect(output).toContain('function(sender: Player, ...)');
});

it('recognizes an assigned engine callback through its receiver', () => {
  const listener: Expression = {kind:'function-expr', params:['p','payload'], isVararg: false, body:block([])};
  const output = source(local('remote', call(prop(ident('Instance'), 'new'), lit('RemoteFunction'))),
    assign(prop(ident('remote'), 'OnServerInvoke'), listener));
  expect(output).toContain('function(p: Player, payload)');
  const custom = source(assign(prop(ident('custom'), 'OnServerInvoke'), listener));
  expect(custom).toContain('function(p, payload)');
});
