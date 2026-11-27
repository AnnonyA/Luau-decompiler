import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {decompile} from '../src/decompile.ts';
import {isValidIdentifier} from '../src/reconstruct/Naming.ts';

const profiles = [0, 1, 2].flatMap(opt => [1, 2].map(debug => `O${opt}g${debug}`));
const names = ['method-result-call', 'materialized-list-writes', 'constructor-before-return', 'contextual-continue', 'conditional-method-calls'];
const fixture = (name: string, profile: string) => readFileSync(new URL(
  `fixtures/rosetta-semantics/${name}-${profile}.luauc`, import.meta.url));

function nodes(value: unknown, kind: string): any[] {
  if (!value || typeof value !== 'object') return [];
  const node = value as Record<string, unknown>;
  return [...(node.kind === kind ? [node] : []), ...Object.values(node).flatMap(child => nodes(child, kind))];
}

describe('call, constructor and contextual identifier boundaries', () => {
  it.each(profiles)('keeps all compiled regressions representable at %s', profile => {
    for (const name of names) {
      const result = decompile(fixture(name, profile), {opcodeEncoding: 'official'});
      expect(result.ok, name).toBe(true);
      if (!result.ok) throw new Error(result.error);
      expect(result.validation, name).toEqual([]);
      for (const block of nodes(result.ast, 'block')) {
        const terminal = block.statements.findIndex((statement: any) => statement.kind === 'return');
        expect(terminal === -1 || terminal === block.statements.length - 1, name).toBe(true);
      }
    }
  });

  it.each(profiles)('calls the function returned by a method at %s', profile => {
    const result = decompile(fixture('method-result-call', profile));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    const nested = nodes(result.ast, 'call').find(call => call.callee.kind === 'method-call');
    expect(nested).toBeDefined();
    expect(nested.callee.name).toBe('factory');
    expect(nested.callee.args).toEqual([{kind: 'literal', value: 3}]);
    expect(nested.args).toEqual([
      {kind: 'literal', value: 4}, {kind: 'literal', value: 5}, {kind: 'literal', value: null},
    ]);
  });

  it('updates the same materialized constructor when SETLIST arrives later', () => {
    const result = decompile(fixture('materialized-list-writes', 'O0g1'));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    const write = nodes(result.ast, 'assign').find(assignment => assignment.targets.length === 2 &&
      assignment.targets.every((target: any) => target.kind === 'index'));
    expect(write).toBeDefined();
    expect(write.targets.map((target: any) => target.key)).toEqual([
      {kind: 'literal', value: 1}, {kind: 'literal', value: 2},
    ]);
    expect(write.targets[0].table).toEqual(write.targets[1].table);
    expect(write.values).toEqual([{kind: 'literal', value: 'alpha'}, {kind: 'literal', value: 'omega'}]);
    const name = write.targets[0].table.name;
    expect(nodes(result.ast, 'local').some(local => local.names.includes(name) &&
      local.values.some((value: any) => value.kind === 'table' && value.fields.some((field: any) =>
        field.value.kind === 'literal' && field.value.value === 17)))).toBe(true);
  });

  it('accepts continue where the parser accepts an identifier', () => {
    expect(isValidIdentifier('continue')).toBe(true);
    expect(isValidIdentifier('return')).toBe(false);
    const result = decompile(fixture('contextual-continue', 'O1g1'));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.validation).toEqual([]);
    expect(result.source).toContain('continue = 6');
    expect(result.source).toContain(':continue(5)');
  });

  it.each(profiles)('retains implicit self through speculative conditional arms at %s', profile => {
    const result = decompile(fixture('conditional-method-calls', profile));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    const methods = nodes(result.ast, 'method-call');
    expect(methods.filter(call => call.name === 'read').every(call => call.args.length === 1)).toBe(true);
    expect(methods.filter(call => call.name === 'format').every(call => call.args.length === 1)).toBe(true);
    expect(nodes(result.ast, 'call').filter(call => call.callee.kind === 'method-call')).toEqual([]);
  });
});
