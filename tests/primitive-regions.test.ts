import {expect, it} from 'vitest';
import {block, chunk, ident, lit, type Expression, type Statement} from '../src/ast/Ast.ts';
import {recoverPrimitiveRegions} from '../src/reconstruct/PrimitiveRegions.ts';
import {printLuau} from '../src/print/LuauPrinter.ts';
import {analyzeBindings} from '../src/analysis/Bindings.ts';

const local = (name: string, value: Expression): Statement => ({kind: 'local', names: [name], values: [value]});
const binary = (op: Extract<Expression, {kind: 'binary'}>['op'], left: Expression, right: Expression): Expression => ({kind: 'binary', op, left, right});
const set = (name: string, value: Expression): Statement => ({kind: 'assign', targets: [ident(name)], values: [value]});
const add = (name: string, value: Expression): Statement => ({kind: 'compound-assign', target: ident(name), op: '+', value});
const ret = (...values: Expression[]): Statement => ({kind: 'return', values});
const call = (name: string, args: Expression[] = []): Expression => ({kind: 'call', callee: ident(name), args, open: false});
const guard = (test: Expression, statements: Statement[]): Statement => ({kind: 'if', test, consequent: block(statements), branches: []});
const fn = (body: Statement[], name = 'accumulate'): Extract<Statement, {kind: 'function-decl'}> => ({kind: 'function-decl', local: true,
  name, params: ['limit'], isVararg: false, line: 10, body: block(body)});
function prefix(limit: Expression = ident('limit'), result = 'total', counter = 'index'): Statement[] {
  return [local(result, lit(0)), local(counter, lit(0)), {kind: 'while', test: binary('<', ident(counter), limit),
    body: block([add(counter, lit(1)), add(result, binary('*', ident(counter), lit(3)))])}];
}
const helper = () => fn([...prefix(), ret(ident('total'), lit(null), ident('index'))]);
const copy = (limit: Expression = lit(4)) => prefix(limit, 'answer', 'step');
function run(input: Statement[], evidence = new Set([10])) {
  const ast = chunk(input), original = structuredClone(ast), names = new Set<string>();
  const result = recoverPrimitiveRegions(ast, evidence, names);
  expect(ast).toEqual(original);
  return {result, names};
}

it('recovers a complete private loop and explicitly clips a retained fixed tuple to one value', () => {
  const {result, names} = run([helper(), ...copy(), ret(ident('answer'))]);
  expect(result.body.statements.slice(1)).toEqual([local('answer', call('accumulate', [lit(4)])), ret(ident('answer'))]);
  expect(names).toEqual(new Set(['accumulate']));
  expect(printLuau(result)).toContain('local answer = accumulate(4)');
});
it('matches lexical bindings rather than parameter or scratch spellings', () => {
  const loop: Statement = {kind: 'numeric-for', name: 'argument', start: lit(1), stop: lit(3), body: block(copy(ident('argument')))};
  const {result} = run([helper(), loop]);
  expect((result.body.statements[1] as Extract<Statement, {kind: 'numeric-for'}>).body.statements)
    .toEqual([local('answer', call('accumulate', [ident('argument')]))]);
});
it.each(['numeric-for', 'repeat'] as const)('preserves the same %s loop shape', kind => {
  const h = helper(), actual = copy();
  const make = (limit: Expression, result: string, index: string): Statement => kind === 'numeric-for' ?
    {kind, name: 'iteration', start: lit(1), stop: limit, body: block([add(result, ident('iteration'))])} :
    {kind, test: binary('>=', ident(index), limit), body: block([add(index, lit(1)), add(result, ident(index))])};
  h.body.statements[2] = make(ident('limit'), 'total', 'index');
  actual[2] = make(lit(4), 'answer', 'step');
  const {result} = run([h, ...actual, ret(ident('answer'))]);
  expect(result.body.statements[1]).toEqual(local('answer', call('accumulate', [lit(4)])));
});
it('keeps nested break and continue targets when the entire loop trees agree', () => {
  const h = helper(), actual = copy();
  for (const [loop, index] of [[h.body.statements[2], 'index'], [actual[2], 'step']] as const) {
    if (loop?.kind !== 'while') throw Error();
    loop.body.statements.splice(1, 0, guard(binary('==', binary('%', ident(index), lit(2)), lit(0)), [{kind: 'continue'}]),
      {kind: 'numeric-for', name: 'inner', start: lit(1), stop: lit(2), body: block([guard(binary('==', ident('inner'), lit(2)), [{kind: 'break'}])])});
  }
  expect(run([h, ...actual]).result.body.statements[1]).toEqual(local('answer', call('accumulate', [lit(4)])));
});
it('does not claim line overlap proves a recovery and refuses competing helpers', () => {
  const input = [helper(), ...copy()];
  expect(run(input, new Set()).result).toEqual(chunk(input));
  const other = helper(); other.name = 'other';
  const ambiguous = [helper(), other, ...copy()];
  expect(run(ambiguous).result).toEqual(chunk(ambiguous));
});
it('refuses unknown parameters, globals, table operands and effectful argument expressions', () => {
  for (const value of [ident('external'), call('nextLimit'), {kind: 'table', fields: []}, {kind: 'vararg'}] as Expression[]) {
    const input = [helper(), ...copy(value)];
    expect(run(input).result).toEqual(chunk(input));
  }
  const unknown = fn([...copy(ident('limit')), ret(ident('answer'))], 'outer');
  const input = [helper(), unknown];
  expect(run(input).result).toEqual(chunk(input));
});
it('refuses a parameter whose cell changes in the copied region', () => {
  const h = helper(), actual = copy(ident('argument'));
  const loop = actual[2]; if (loop.kind !== 'while') throw Error();
  const extra = add('argument', lit(1));
  loop.body.statements.push(extra);
  const originalLoop = h.body.statements[2]; if (originalLoop.kind !== 'while') throw Error();
  originalLoop.body.statements.push(add('limit', lit(1)));
  const input = [h, local('argument', lit(4)), ...actual];
  expect(run(input).result).toEqual(chunk(input));
});
it('refuses globals, callbacks, allocations, captures and nonprimitive stores in a matching body', () => {
  const changes = [
    (name: string): Statement => ({kind: 'expression-stmt', expression: call('observe', [ident(name)])}),
    (name: string): Statement => set(name, ident('external')),
    (name: string): Statement => set(name, {kind: 'table', fields: []}),
    (name: string): Statement => local('reader', {kind: 'function-expr', params: [], isVararg: false, body: block([ret(ident(name))])}),
  ];
  for (const change of changes) {
    const h = helper(), actual = copy();
    for (const [loop, name] of [[h.body.statements[2], 'total'], [actual[2], 'answer']] as const) {
      if (loop?.kind !== 'while') throw Error(); loop.body.statements.push(change(name));
    }
    const input = [h, ...actual]; expect(run(input).result).toEqual(chunk(input));
  }
});
it('retains a scratch cell observed after the region, including through a closure', () => {
  for (const tail of [ret(ident('step')), local('reader', {kind: 'function-expr', params: [], isVararg: false, body: block([ret(ident('answer'))])})]) {
    const input = [helper(), ...copy(), tail]; expect(run(input).result).toEqual(chunk(input));
  }
});
it('rejects a shared identifier occurrence that would hide a scratch read outside the region', () => {
  const actual = copy(), shared = ident('step');
  const loop = actual[2]; if (loop.kind !== 'while' || loop.test.kind !== 'binary') throw Error();
  loop.test.left = shared;
  const input = [helper(), ...actual, ret(shared)];
  expect(run(input).result).toEqual(chunk(input));
});
it('rejects a shared result expression instead of replacing its deferred occurrence', () => {
  const nan = (): Expression => binary('/', lit(0), lit(0)), shared = nan();
  const h = helper(); h.body.statements[h.body.statements.length - 1] = ret(nan());
  const factory = fn([h, ...copy(), {kind: 'expression-stmt', expression: call('observe', [shared])},
    local('deferred', {kind: 'function-expr', params: [], isVararg: false, body: block([ret(shared)])})], 'factory');
  factory.params = [];
  const input = [factory];
  expect(run(input).result).toEqual(chunk(input));
});
it('rejects an identifier node shared by different lexical bindings', () => {
  const shared = ident('argument'), caller = fn([ret(shared)], 'caller'); caller.params = ['argument'];
  const input = [helper(), local('argument', lit(4)), ...copy(shared), caller];
  expect(run(input).result).toEqual(chunk(input));
});
it('allows shared provenance and annotation arrays without treating them as shared syntax', () => {
  const h = helper(), actual = copy();
  const provenance = {prototypeId: 1, pc: 3, register: 0}, annotations = ['number'];
  for (const statement of [...h.body.statements, ...actual]) if (statement.kind === 'local') {
    statement.definition = provenance; statement.types = annotations;
  }
  const first = call('observe'), second = call('observe');
  if (first.kind !== 'call' || second.kind !== 'call') throw Error();
  first.evaluation = second.evaluation = {ownerProtoId: 1, pc: 7, operandPcs: []};
  const {result, names} = run([h, ...actual, {kind: 'expression-stmt', expression: first},
    {kind: 'expression-stmt', expression: second}]);
  expect(names).toEqual(new Set(['accumulate']));
  expect(result.body.statements[1]).toMatchObject(local('answer', call('accumulate', [lit(4)])));
});
it('does not swallow a caller return or confuse mismatched loop control', () => {
  const h = helper(), actual = copy(), loop = actual[2]; if (loop.kind !== 'while') throw Error();
  loop.body.statements.push(ret(ident('answer')));
  expect(run([h, ...actual]).result).toEqual(chunk([h, ...actual]));
  const nested = helper(), original = nested.body.statements[2]; if (original.kind !== 'while') throw Error();
  original.body.statements.push({kind: 'break'});
  const copied = copy(), copiedLoop = copied[2]; if (copiedLoop.kind !== 'while') throw Error();
  copiedLoop.body.statements.push({kind: 'continue'});
  expect(run([nested, ...copied]).result).toEqual(chunk([nested, ...copied]));
});
it('rejects mixed primitive types that could raise and expose an added frame', () => {
  const input = [helper(), ...copy(lit('4'))];
  expect(run(input).result).toEqual(chunk(input));
  const h = helper(), actual = copy();
  h.body.statements[0] = local('total', lit(null)); actual[0] = local('answer', lit(null));
  expect(run([h, ...actual]).result).toEqual(chunk([h, ...actual]));
});
it('rejects variadic or open-result helpers even if the first result resembles a local', () => {
  const h = helper(); h.isVararg = true;
  expect(run([h, ...copy()]).result).toEqual(chunk([h, ...copy()]));
  for (const value of [call('extra'), {kind: 'vararg'}] as Expression[]) {
    const h = helper();
    h.body.statements[h.body.statements.length - 1] = ret(ident('total'), value);
    expect(run([h, ...copy()]).result).toEqual(chunk([h, ...copy()]));
  }
});
it('does not add a helper upvalue to a caller that did not already capture it', () => {
  const caller = fn([...copy(), ret(ident('answer'))], 'caller'); caller.params = [];
  const input = [helper(), caller]; expect(run(input).result).toEqual(chunk(input));
  caller.body.statements.unshift(local('retained', ident('accumulate')));
  expect(printLuau(run([helper(), caller]).result)).toContain('local answer = accumulate(4)');
});
it('respects callee shadowing, mutation and branch dominance', () => {
  for (const extra of [local('accumulate', lit(7)), set('accumulate', call('replacement'))]) {
    const input = [helper(), extra, ...copy()]; expect(run(input).result).toEqual(chunk(input));
  }
  const input = [guard(ident('condition'), [helper()]), ...copy()];
  expect(run(input).result).toEqual(chunk(input));
});
it('does not infer missing arguments or move a scratch initializer into its own call', () => {
  const h = helper(); h.params.push('unused');
  const input = [h, ...copy()]; expect(run(input).result).toEqual(chunk(input));
  const actual = copy(ident('step'));
  expect(run([helper(), ...actual]).result).toEqual(chunk([helper(), ...actual]));
});
it('preserves a returned local scope while leaving later writes in place', () => {
  const input = [helper(), ...copy(), set('answer', lit(9)), ret(ident('answer'))];
  expect(run(input).result.body.statements.slice(1)).toEqual([local('answer', call('accumulate', [lit(4)])), set('answer', lit(9)), ret(ident('answer'))]);
});

const array = (...values: Expression[]): Expression => ({kind: 'table', fields: values.map(value => ({value}))});
function search(items: Expression, needle: Expression, name = 'position'): Statement[] {
  return [local(name, lit(null)), {kind: 'generic-for', names: ['key', 'value'], iterators: [items], body: block([
    guard(binary('~=', ident('value'), needle), [{kind: 'continue'}]), set(name, ident('key')), {kind: 'break'},
  ])}];
}
const selected = (name: string): Expression => ({kind: 'if-expr', test: binary('==', ident(name), lit(null)),
  consequent: lit('absent'), branches: [], alternate: ident(name)});
function searchHelper(): Extract<Statement, {kind: 'function-decl'}> {
  const h = fn([...search(ident('items'), ident('needle')), ret(selected('position'))], 'locate');
  h.params = ['items', 'needle']; return h;
}
it('recovers native iteration over one fresh primitive array and a conditional scalar result', () => {
  const items = array(lit(3), lit(false), lit('key'), lit(null), lit(9));
  const input = [searchHelper(), ...search(items, lit('key'), 'found'), local('answer', selected('found')), ret(ident('answer'))];
  expect(run(input).result.body.statements.slice(1)).toEqual([
    local('answer', call('locate', [items, lit('key')])), ret(ident('answer')),
  ]);
});
it('keeps a recovered scalar before an effectful consumer instead of delaying its loop into an argument', () => {
  const input = [searchHelper(), ...search(array(), lit(3), 'found'),
    {kind: 'expression-stmt', expression: call('observe', [call('first'), selected('found')])} as Statement];
  const result = run(input).result.body.statements;
  expect(result).toHaveLength(3);
  expect(result[1]).toMatchObject({kind: 'local', values: [call('locate', [array(), lit(3)])]});
  const name = (result[1] as Extract<Statement, {kind: 'local'}>).names[0]!;
  expect(result[2]).toEqual({kind: 'expression-stmt', expression: call('observe', [call('first'), ident(name)])});
});
it.each(['local', 'assign', 'return', 'expression-stmt'] as const)('recovers a result in an immediate %s consumer', kind => {
  const make = (value: Expression): Statement => kind === 'local' ? local('answer', value) :
    kind === 'assign' ? set('answer', value) : kind === 'return' ? ret(value) :
      {kind, expression: call('observe', [value])};
  const items = array(lit(7), lit(9));
  const input = [searchHelper(), ...search(items, lit(9), 'found'), make(selected('found'))];
  const result = run(input).result.body.statements;
  if (kind === 'local') expect(result.slice(1)).toEqual([local('answer', call('locate', [items, lit(9)]))]);
  else {
    expect(result).toHaveLength(3);
    const temporary = result[1] as Extract<Statement, {kind: 'local'}>;
    expect(temporary).toEqual(local(temporary.names[0]!, call('locate', [items, lit(9)])));
    expect(result[2]).toEqual(make(ident(temporary.names[0]!)));
  }
});
it.each(['function-expr', 'function-decl', 'nested-function-expr', 'if', 'while', 'do'] as const)(
  'does not move a result out of a deferred %s consumer region or add a NaN capture', kind => {
    const nan = (): Expression => binary('/', lit(0), lit(0));
    const h = helper(); h.body.statements[h.body.statements.length - 1] = ret(nan());
    const closure: Expression = {kind: 'function-expr', params: [], isVararg: false, body: block([ret(nan())])};
    const deferred = fn([ret(nan())], 'deferred'); deferred.params = [];
    const consumer: Statement = kind === 'function-expr' ? local('deferred', closure) :
      kind === 'nested-function-expr' ? local('record', {kind: 'table', fields: [{name: 'deferred', value: closure}]}) :
      kind === 'function-decl' ? deferred : kind === 'if' ? guard(lit(false), [ret(nan())]) :
      kind === 'while' ? {kind, test: lit(false), body: block([ret(nan())])} : {kind, body: block([ret(nan())])};
    const factory = fn([h, ...copy(), consumer], 'factory'); factory.params = [];
    const input = [factory];
    const {result, names} = run(input);
    expect(result).toEqual(chunk(input));
    expect(names.size).toBe(0);
  },
);
it('rejects array aliases, effectful entries, nonprimitive values and nonarray keys', () => {
  const forbidden = [ident('items'), call('newItems'), array(call('entry')), array({kind: 'table', fields: []}),
    {kind: 'table', fields: [{name: 'slot', value: lit(3)}]},
    {kind: 'table', fields: [{key: lit(1), value: lit(3)}]},
  ] as Expression[];
  for (const items of forbidden) {
    const input = [searchHelper(), local('items', array(lit(3))), ...search(items, lit(3), 'found'), local('answer', selected('found'))];
    expect(run(input).result).toEqual(chunk(input));
  }
});
it('rejects element or needle types that can invoke an equality metamethod', () => {
  const unknown = local('value', call('makeObject'));
  for (const [items, needle] of [[array(ident('value')), lit(3)], [array(lit(3)), ident('value')]]) {
    const input = [searchHelper(), unknown, ...search(items, needle, 'found'), local('answer', selected('found'))];
    expect(run(input).result).toEqual(chunk(input));
  }
});
it('does not move an array allocation across an earlier loop', () => {
  const earlier: Statement = {kind: 'numeric-for', name: 'j', start: lit(1), stop: lit(2), body: block([])};
  const h = searchHelper(); h.body.statements.unshift(earlier);
  const input = [h, structuredClone(earlier), ...search(array(lit(3)), lit(3), 'found'), local('answer', selected('found'))];
  expect(run(input).result).toEqual(chunk(input));
});
it('retains every scratch reference outside a selected result expression', () => {
  const input = [searchHelper(), ...search(array(lit(3)), lit(3), 'found'),
    {kind: 'expression-stmt', expression: call('observe', [selected('found'), ident('found')])} as Statement];
  expect(run(input).result).toEqual(chunk(input));
});
it('refuses a duplicate use of an allocated argument and competing result sites', () => {
  const h = searchHelper(); h.body.statements.splice(2, 0, {kind: 'generic-for', names: ['k'], iterators: [ident('items')], body: block([])});
  const copied = [...search(array(lit(3)), lit(3), 'found'),
    {kind: 'generic-for', names: ['k'], iterators: [array(lit(3))], body: block([])} as Statement];
  const input = [h, ...copied, local('answer', selected('found'))];
  expect(run(input).result).toEqual(chunk(input));
  const constant = searchHelper(); constant.body.statements[2] = ret(lit(false));
  const ambiguous = [constant, ...search(array(lit(3)), lit(3), 'found'), ret(lit(false), lit(false))];
  expect(run(ambiguous).result).toEqual(chunk(ambiguous));
});
it('keeps a conservative register bound without assuming native inlining', () => {
  const locals = Array.from({length: 185}, (_, index) => local('padding' + index, lit(index)));
  const input = [...locals, helper(), ...copy()];
  expect(run(input).result).toEqual(chunk(input));
});
it('charges a wide constructor and nested operands as well as the live parameter bindings', () => {
  let nested: Expression = lit(1);
  for (let i = 0; i < 8; i++) nested = binary('+', lit(i), nested);
  const items = array(nested, ...Array.from({length: 63}, (_, i) => lit(i)));
  const outer = fn([searchHelper(), ...search(items, lit(3), 'found'), local('answer', selected('found'))], 'wide');
  outer.params = Array.from({length: 100}, (_, index) => 'argument' + index);
  const input = [outer];
  expect(analyzeBindings(chunk(input).body).bindings.length).toBeLessThan(180);
  expect(run(input).result).toEqual(chunk(input));
});
