import {expect, it} from 'vitest';
import {block, chunk, ident, lit, type Expression, type Statement} from '../src/ast/Ast.ts';
import {analyzeBindings} from '../src/analysis/Bindings.ts';
import {inferHumanNames} from '../src/reconstruct/NameInference.ts';
import {styleLocalNames} from '../src/reconstruct/NameStyle.ts';
import {printLuau} from '../src/print/LuauPrinter.ts';
import {NameAllocator} from '../src/reconstruct/Naming.ts';
import {reconstructFunction} from '../src/reconstruct/Reconstructor.ts';
import {abc, decode, Opcode, proto, ret} from './helpers.ts';

const named = (name: string, statements: Statement[]): Statement => ({
  kind: 'function-decl', local: true, name, params: [], isVararg: false, body: block(statements),
});
const returns = (...values: Expression[]): Statement => ({kind: 'return', values});

it.each(['declaration', 'expression'] as const)('keeps an uncaptured ancestor name available inside a function %s', form => {
  const body = block([named('decode', [returns(lit(2))]), returns(ident('decode'))]);
  const factory: Statement = form === 'declaration'
    ? named('factory', body.statements)
    : {kind: 'local', names: ['factory'], values: [{kind: 'function-expr', params: [], isVararg: false, body}]};
  const output = inferHumanNames(chunk([
    named('decode', [returns(lit(1))]), factory, returns(ident('decode'), ident('factory')),
  ]), {foldSingleUseTemps: false});
  expect(analyzeBindings(output.body).bindings.filter(binding => binding.name === 'decode')).toHaveLength(2);
  expect(analyzeBindings(output.body).globals).toEqual(new Set());
});

it('preserves transitive captured cells when inference renames a generated outer local', () => {
  const output = inferHumanNames(chunk([
    {kind: 'local', names: ['value'], values: [{kind: 'property', object: ident('record'), name: 'Count'}]},
    named('factory', [
      {kind: 'local', names: ['count'], values: [lit(2)]},
      named('read', [returns(ident('value'), ident('count'))]),
      returns(ident('read')),
    ]),
    returns(ident('factory')),
  ]), {foldSingleUseTemps: false});
  const analysis = analyzeBindings(output.body);
  expect(analysis.globals).toEqual(new Set(['record']));
  const outer = analysis.bindings.find(binding => binding.declaration === output.body.statements[0])!;
  expect(outer.captured).toBe(true);
  expect(outer.reads).toHaveLength(1);
  expect(analysis.bindings.filter(binding => binding.captured && binding.name.startsWith('count'))).toHaveLength(2);
});

it('applies a tuple result hint to its own binding when a sibling reuses the working name', () => {
  const ast = chunk([
    named('first', [{kind: 'local', names: ['result'], values: [lit(1)]}, returns(ident('result'))]),
    named('second', [
      {kind: 'local', names: ['callback', 'result'], values: [{kind: 'call', callee: ident('makeAccumulator'), args: [], open: false}]},
      returns(ident('callback'), ident('result')),
    ]),
  ]);
  const output = printLuau(inferHumanNames(ast, {foldSingleUseTemps: false}));
  expect(output).toContain('local result = 1');
  expect(output).toContain('local accumulator, stats = makeAccumulator()');
});

it.each([{generatedNames: 'compact'}, {nameCasing: 'PascalCase'}] as const)(
  'keeps the debug name of a function assigned to an existing captured cell with %j', options => {
    const ast = chunk([
      {kind: 'local', names: ['decode'], values: []},
      named('read', [returns(ident('decode'))]),
      {kind: 'assign', targets: [ident('decode')], values: [
        {kind: 'function-expr', params: [], isVararg: false, debugName: 'decode', body: block([returns(ident('decode'))])},
      ]},
      returns(ident('read')),
    ]);
    const output = styleLocalNames(ast, options);
    expect(printLuau(output)).toContain('function decode()');
    const binding = analyzeBindings(output.body).bindings.find(item => item.name === 'decode')!;
    expect(binding.captured).toBe(true);
    expect(binding.reads).toHaveLength(2);
    expect(binding.writes).toHaveLength(1);
  },
);

it('reserves all free capture-expression identifiers without reserving nested bindings or field labels', () => {
  const names = ['owner', 'key', 'free', 'bound', 'localValue', 'field'];
  const {module} = decode(proto({
    numParams: names.length, numUpvalues: 1, upvalueNames: ['capture'],
    locals: names.map((name, register) => ({name, register, startPc: 0, endPc: 2})),
    instructions: [abc(Opcode.GETUPVAL, 6, 0), abc(Opcode.RETURN, 0, 8)],
  }));
  const capture: Expression = {kind: 'table', fields: [
    {name: 'field', value: {kind: 'index', table: {kind: 'property', object: ident('owner'), name: 'bound'}, key: ident('key')}},
    {value: {kind: 'function-expr', params: ['bound'], isVararg: false, body: block([
      {kind: 'local', names: ['localValue'], values: [lit(1)]},
      returns(ident('free'), ident('bound'), ident('localValue')),
    ])}},
  ]};
  const fn = reconstructFunction(module, module.prototypes[module.mainProtoId]!, {
    allocator: new NameAllocator(), captures: new Map([[0, {expression: capture, mutable: false}]]),
  });
  expect(fn.params).toEqual(['owner2', 'key2', 'free2', 'bound', 'localValue', 'field']);
  expect(analyzeBindings(block([returns({kind: 'function-expr', params: fn.params, isVararg: false, body: fn.body})])).globals)
    .toEqual(new Set(['owner', 'key', 'free']));
});

it('reserves fallback upvalue names when reconstructing a prototype without parent context', () => {
  const {module} = decode(proto({numParams: 1, numUpvalues: 1, upvalueNames: ['value'],
    instructions: [abc(Opcode.GETUPVAL, 1, 0), abc(Opcode.RETURN, 0, 3)]}));
  const fn = reconstructFunction(module, module.prototypes[module.mainProtoId]!);
  expect(fn.params).toEqual(['value2']);
});

it('starts a child from immutable reservations, independent of parent allocations and rollbacks', () => {
  const {module} = decode(proto({numParams: 1, instructions: [ret()]}));
  const allocator = new NameAllocator(['value2'], ['value3']);
  const snapshot = allocator.snapshot();
  expect(allocator.reserve('value')).toBe('value');
  const reconstruct = () => reconstructFunction(module, module.prototypes[module.mainProtoId]!, {allocator, captures: new Map()}).params;
  expect(reconstruct()).toEqual(['value']);
  expect(reconstruct()).toEqual(['value']);
  allocator.restore(snapshot);
  expect(reconstruct()).toEqual(['value']);
  expect(allocator.reserve('value')).toBe('value');
});
