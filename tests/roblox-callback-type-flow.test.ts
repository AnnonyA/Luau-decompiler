import {readFileSync} from 'node:fs';
import {expect, it} from 'vitest';
import {block, chunk, ident, lit, type Expression, type Statement} from '../src/ast/Ast.ts';
import {cleanupAst} from '../src/ast/AstCleanup.ts';
import {decompile} from '../src/decompile.ts';
import {printLuau} from '../src/print/LuauPrinter.ts';
import {recoverFunctionEvidence} from '../src/reconstruct/FunctionEvidence.ts';

const call = (name: string, ...args: Expression[]): Expression => ({kind: 'call', callee: ident(name), args, open: false});
const property = (object: Expression, name: string): Expression => ({kind: 'property', object, name});
const invoke = (object: Expression, name: string, ...args: Expression[]): Expression => ({kind: 'method-call', object, name, args, open: false});
const statement = (expression: Expression): Statement => ({kind: 'expression-stmt', expression});

interface Registration {
  before?: Statement[];
  after?: Statement[];
  receiver?: Expression;
  helperResult?: Expression;
  helperStart?: Statement[];
  callbackStart?: Statement[];
  callbackParam?: string;
  method?: 'Connect' | 'Once';
  namedCallback?: boolean;
}

function registration({before = [], after = [], receiver = invoke(ident('game'), 'GetService', lit('Players')),
  helperResult = property(ident('p'), 'DisplayName'), helperStart = [], callbackStart = [],
  callbackParam = 'p', method = 'Connect', namedCallback = false}: Registration = {}) {
  const callbackBody = block([...callbackStart, statement(call('print', call('formatName', ident(callbackParam))))]);
  const callback: Expression = {kind: 'function-expr', params: [callbackParam], isVararg: false, body: callbackBody};
  const named: Statement[] = namedCallback ? [{kind: 'function-decl', local: true, name: 'onJoin', params: [callbackParam],
    isVararg: false, body: callbackBody}] : [];
  return chunk([
    ...before,
    {kind: 'local', names: ['players'], values: [receiver]},
    {kind: 'function-decl', name: 'formatName', local: true, params: ['p'], isVararg: false,
      body: block([...helperStart, {kind: 'return', values: [helperResult]}])},
    ...named,
    statement(invoke(property(ident('players'), 'PlayerAdded'), method, namedCallback ? ident('onJoin') : callback)),
    ...after,
  ]);
}

it.each([
  ['contradictory input', call('formatName', lit('guest'))],
  ['unknown input', call('formatName', ident('external'))],
  ['omitted argument', call('formatName')],
  ['open argument pack', call('formatName', call('argumentsFromCaller'))],
  ['escaped helper', call('retain', ident('formatName'))],
] as const)('keeps the helper signature unknown for %s', (_, expression) => {
  const output = printLuau(recoverFunctionEvidence(registration({after: [statement(expression)]})));
  expect(output).toContain('PlayerAdded:Connect(function(p: Player)');
  expect(output).toContain('function formatName(p)\n');
});

it.each(['Connect', 'Once'] as const)('keeps both signatures unknown after cleanup on a custom PlayerAdded:%s', method => {
  const ast = registration({receiver: ident('customEmitter'), method, callbackParam: 'value'});
  const cleaned = cleanupAst(ast, {typeAnnotations: 'useful', ifExpressions: false, earlyReturn: false,
    interpolatedStrings: false, mathConstants: false});
  const output = printLuau(recoverFunctionEvidence(cleaned));
  expect(output).toContain(`PlayerAdded:${method}(function(player)\n`);
  expect(output).toContain('function formatName(p)\n');
});

it('follows a verified one-shot PlayerAdded registration', () => {
  const output = printLuau(recoverFunctionEvidence(registration({method: 'Once'})));
  expect(output).toContain('PlayerAdded:Once(function(p: Player)');
  expect(output).toContain('function formatName(p: Player): string\n');
});

it.each([false, true])('checks every use of a named callback (escaped=%s)', escaped => {
  const after = escaped ? [statement(call('retain', ident('onJoin')))] : [];
  const output = printLuau(recoverFunctionEvidence(registration({namedCallback: true, after})));
  expect(output).toContain(escaped ? 'function onJoin(p)\n' : 'function onJoin(p: Player)');
  expect(output).toContain(escaped ? 'function formatName(p)\n' : 'function formatName(p: Player): string\n');
});

const overwrite = (name: string): Statement => ({kind: 'assign', targets: [ident(name)], values: [ident('external')]});
it.each(['callbackStart', 'helperStart'] as const)('rejects mutable parameter evidence in %s', key => {
  const output = printLuau(recoverFunctionEvidence(registration({[key]: [overwrite('p')]})));
  expect(output).toContain(key === 'callbackStart' ? 'Connect(function(p)\n' : 'Connect(function(p: Player)');
  expect(output).toContain('function formatName(p)\n');
});

it.each([
  ['shadowed', {kind: 'local', names: ['game'], values: [ident('customGame')]}],
  ['assigned', overwrite('game')],
] satisfies Array<[string, Statement]>)('rejects the registration when game is %s', (_, setup) => {
  const output = printLuau(recoverFunctionEvidence(registration({before: [setup]})));
  expect(output).toContain('PlayerAdded:Connect(function(p)\n');
  expect(output).toContain('function formatName(p)\n');
});

it.each([
  ['UserId', property(ident('p'), 'UserId'), ': number'],
  ['GetFullName', invoke(ident('p'), 'GetFullName'), ': string'],
  ['GetAttribute', invoke(ident('p'), 'GetAttribute', lit('nickname')), ''],
] as const)('uses the verified return contract for %s', (_, helperResult, annotation) => {
  const output = printLuau(recoverFunctionEvidence(registration({helperResult})));
  expect(output).toContain(`function formatName(p: Player)${annotation}\n`);
});

for (const typeAnnotations of ['functions', 'useful', 'off'] as const) {
  it.each([0, 1, 2])(`follows the official call sites with annotations ${typeAnnotations} at O%s`, level => {
    const bytecode = readFileSync(new URL(`./fixtures/rewrites/player-callback-helper-O${level}.luauc`, import.meta.url));
    const result = decompile(bytecode, {opcodeEncoding: 'official', typeAnnotations});
    if (!result.ok) throw Error(result.error);
    const {source} = result;
    const typed = typeAnnotations !== 'off';
    expect(source).toContain(typed ? 'PlayerAdded:Connect(function(p: Player)' : 'PlayerAdded:Connect(function(p)');
    // O2 inlines the only call, so the retained helper has no typed caller.
    expect(source).toContain(typed && level < 2 ? 'function formatName(p: Player): string\n' : 'function formatName(p)\n');
    expect(source).toContain(level < 2 ? 'print(formatName(p))' : 'print(p.DisplayName)');
    if (!typed) expect(source).not.toMatch(/:\s*(?:Players?|string)\b/);
  });
}
