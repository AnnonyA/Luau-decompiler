import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {expect, it} from 'vitest';
import type {Expression} from '../src/ast/Ast.ts';
import {decodeBytecode} from '../src/decode/Decoder.ts';
import {reconstructFunction} from '../src/reconstruct/Reconstructor.ts';
import {abc, decode, Opcode, proto, strings} from './helpers.ts';

const values: Array<[string, unknown]> = [
  ['false', false], ['nil', null], ['zero', 0], ['negative zero', -0],
  ['empty string', ''], ['NaN', NaN], ['object', {}], ['closure', () => 1],
];
for (const opcode of [Opcode.AND, Opcode.OR]) for (const [label, value] of values) {
  it(`copies ${label} once through ${Opcode[opcode]} and retains one result`, () => {
    // Exercise the reconstruction boundary itself. Normalization is an
    // optional bounded pass and can decline a larger otherwise valid proto.
    const module = decode(proto({maxStackSize: 3, constants: strings('produce'), instructions: [
      abc(Opcode.GETGLOBAL, 1), 0,
      abc(Opcode.CALL, 1, 1, 2),
      abc(opcode, 0, 1, 1),
      abc(Opcode.RETURN, 0, 2),
    ]})).module;
    const body = reconstructFunction(module, module.prototypes[module.mainProtoId]!).body;
    let calls = 0;
    const env = new Map<string, unknown>([['produce', () => {calls++; return [value, null, 99];}]]);
    const truthy = (item: unknown) => item !== false && item !== null;
    const one = (expression: Expression): unknown => many(expression)[0];
    const many = (expression: Expression): unknown[] => {
      switch (expression.kind) {
        case 'literal': return [expression.value];
        case 'identifier': return [env.get(expression.name)];
        case 'paren': return [one(expression.expression)];
        case 'call': return (one(expression.callee) as (...args: unknown[]) => unknown[])(...expression.args.map(one));
        case 'binary': {
          const left = one(expression.left);
          if (expression.op === 'and') return [truthy(left) ? one(expression.right) : left];
          if (expression.op === 'or') return [truthy(left) ? left : one(expression.right)];
          throw new Error(`Unexpected operator ${expression.op}`);
        }
        default: throw new Error(`Unexpected expression ${expression.kind}`);
      }
    };
    const list = (expressions: Expression[]) => expressions.flatMap((expression, index) =>
      index === expressions.length - 1 ? many(expression) : [one(expression)]);
    let returned: unknown[] | undefined;
    for (const statement of body.statements) {
      if (statement.kind === 'local') {
        const assigned = list(statement.values);
        statement.names.forEach((name, index) => env.set(name, assigned[index] ?? null));
      } else if (statement.kind === 'return') returned = list(statement.values);
      else throw new Error(`Unexpected statement ${statement.kind}`);
    }
    expect(calls).toBe(1);
    expect(returned).toHaveLength(1);
    expect(Object.is(returned![0], value)).toBe(true);
  });
}

const fixture = (name: string) => readFileSync(new URL(`fixtures/register-self-copies/${name}`, import.meta.url));
const manifest = JSON.parse(fixture('manifest.json').toString()) as {
  entries: Array<{profile: string; bytecode: string; sha256: string; source: string; sourceSha256: string}>;
};
for (const entry of manifest.entries) {
  it(`retains one tagged producer in sealed parallel assignments at ${entry.profile}`, () => {
    const bytes = fixture(entry.bytecode);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256);
    expect(createHash('sha256').update(fixture(entry.source)).digest('hex')).toBe(entry.sourceSha256);
    const module = decodeBytecode(bytes, {opcodeEncoding: 'official'}).module;
    const body = reconstructFunction(module, module.prototypes[module.mainProtoId]!).body;
    const counts = new Map<string, number>();
    const visit = (node: unknown): void => {
      if (!node || typeof node !== 'object') return;
      const expression = node as Expression;
      if (expression.kind === 'call' && expression.args[0]?.kind === 'literal' && typeof expression.args[0].value === 'string') {
        const label = expression.args[0].value;
        counts.set(label, (counts.get(label) ?? 0) + 1);
      }
      for (const child of Object.values(node)) if (Array.isArray(child)) child.forEach(visit); else visit(child);
    };
    visit(body);
    expect(counts.get(entry.profile === 'O1g1+x2' ? 'd2' : 'c2')).toBe(1);
    // Two genuine source calls must both remain, even with identical arguments.
    if (entry.profile === 'O1g1+x2') expect(counts.get('twice')).toBe(2);
  });
}
