import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {chunk, ident, lit, type Block, type Chunk, type FunctionExpression, type Statement} from '../src/ast/Ast.ts';
import {decodeBytecode} from '../src/decode/Decoder.ts';
import {decompile} from '../src/decompile.ts';
import {reconstructFunction} from '../src/reconstruct/Reconstructor.ts';
import {recoverClosureFactories} from '../src/reconstruct/ClosureInlineRecovery.ts';

const bytes = readFileSync(new URL('../benchmarks/closure-identity/runtime-first.luauc', import.meta.url));
function example() {
  const {module} = decodeBytecode(bytes, {opcodeEncoding: 'official'});
  const raw = reconstructFunction(module, module.prototypes[module.mainProtoId]!);
  return {module, ast: chunk(raw.body.statements)};
}
function nestedExample() {
  const bytes = readFileSync(new URL('../benchmarks/closure-identity/bytecode/18_nested_same_capture/O2.luauc', import.meta.url));
  const {module} = decodeBytecode(bytes, {opcodeEncoding: 'official'});
  const raw = reconstructFunction(module, module.prototypes[module.mainProtoId]!);
  return {module, ast: chunk(raw.body.statements)};
}
function objects(node: unknown): object[] {
  if (!node || typeof node !== 'object') return [];
  return [node, ...Object.entries(node).flatMap(([key, value]) => key === 'closureIdentity' ? [] : objects(value))];
}
function factory(ast: Chunk): FunctionExpression {
  return objects(ast).find(node => (node as FunctionExpression).kind === 'function-expr' &&
    (node as FunctionExpression).debugName === 'factory') as FunctionExpression;
}
function captureSites(ast: Chunk): FunctionExpression[] {
  return objects(factory(ast).body).filter(node => (node as FunctionExpression).kind === 'function-expr' &&
    (node as FunctionExpression).closureIdentity?.captureCount === 1) as FunctionExpression[];
}

describe('bounded native closure factory recovery', () => {
  it('recovers both sites together without an activation-local cache or a guessed first capture', () => {
    const {module, ast} = example(), before = structuredClone(ast);
    const result = recoverClosureFactories(ast, module);
    expect(ast).toEqual(before);
    expect(result.requiresOptimization2).toBe(true);
    expect(result.diagnostics.filter(d => d.code === 'closure-identity-native-inline')).toHaveLength(1);
    const calls = objects(result.ast).filter(node => (node as {inlineForIdentity?: boolean}).inlineForIdentity);
    expect(calls).toHaveLength(2);
    expect(captureSites(result.ast)).toHaveLength(0);
  });

  it('emits the actual optimization contract and fixed-result calls through the complete pipeline', () => {
    const result = decompile(bytes, {opcodeEncoding: 'official'});
    expect(result.ok).toBe(true); if (!result.ok) throw Error(result.error);
    expect(result.validation).toEqual([]);
    expect(result.source.startsWith('--!optimize 2\n')).toBe(true);
    expect(result.source).toMatch(/\(closureFactory\w*\(a\)\)/);
    expect(result.source).toMatch(/\(closureFactory\w*\(b\)\)/);
    expect(result.diagnostics.filter(d => d.code === 'closure-identity-unresolved')).toHaveLength(0);
    expect(result.diagnostics.filter(d => d.severity === 'error')).toEqual([]);
  });

  it('does not merge distinct owner/K constants merely because their bodies match', () => {
    const {module, ast} = example();
    const sites = captureSites(ast);
    expect(sites).toHaveLength(2);
    sites[1]!.closureIdentity!.constantIndex += 100;
    expect(recoverClosureFactories(ast, module).requiresOptimization2).toBe(false);
  });

  it('requires the retained factory opcode/capture lineage, independently of debug names', () => {
    const {module, ast} = example();
    for (const proto of module.prototypes) proto.debugName = undefined;
    expect(recoverClosureFactories(ast, module).requiresOptimization2).toBe(true);
    module.prototypes[1]!.numParams += 1;
    const rejected = recoverClosureFactories(ast, module);
    expect(rejected.requiresOptimization2).toBe(false);
    expect(rejected.diagnostics.some(d => d.code === 'closure-identity-inline-unproved')).toBe(true);
  });

  it('refuses a module whose direct environment builtin would disable native inlining', () => {
    for (const name of ['getfenv', 'setfenv']) {
      const {module, ast} = example();
      ast.body.statements.unshift({kind: 'expression-stmt', expression: {
        kind: 'call', callee: ident(name), args: [], open: false,
      }});
      expect(recoverClosureFactories(ast, module).requiresOptimization2).toBe(false);
    }
  });

  it('rejects register pressure before introducing an inline-dependent helper', () => {
    const {module, ast} = example();
    factory(ast).body.statements.unshift(...Array.from({length: 110}, (_, i): Statement => ({
      kind: 'local', names: [`live${i}`], values: [lit(i)],
    })));
    const rejected = recoverClosureFactories(ast, module);
    expect(rejected.requiresOptimization2).toBe(false);
    expect(rejected.diagnostics.some(d => d.message.includes('register bound'))).toBe(true);
  });

  it('refuses the whole group if even one captured function binding is written', () => {
    const {module, ast} = example();
    const name = captureSites(ast)[0]!.closureIdentity!.captureNames![0]!;
    const body = objects(factory(ast).body).find(node => (node as Block).kind === 'block' &&
      (node as Block).statements.some(s => s.kind === 'local' && s.names.includes(name))) as Block;
    const index = body.statements.findIndex(s => s.kind === 'local' && s.names.includes(name));
    body.statements.splice(index + 1, 0, {kind: 'assign', targets: [ident(name)], values: [ident(name)]});
    expect(recoverClosureFactories(ast, module).requiresOptimization2).toBe(false);
  });

  it('requires an actual function initializer, not a parenthesized value or alias', () => {
    const {module, ast} = example();
    const name = captureSites(ast)[0]!.closureIdentity!.captureNames![0]!;
    const declaration = objects(ast).find(node => (node as Statement).kind === 'local' &&
      (node as Extract<Statement, {kind: 'local'}>).names.includes(name)) as Extract<Statement, {kind: 'local'}>;
    declaration.values[0] = {kind: 'paren', expression: declaration.values[0]!};
    expect(recoverClosureFactories(ast, module).requiresOptimization2).toBe(false);
  });

  it('recovers both native pools of a closed H/W chain instead of passing an opaque carrier value', () => {
    const {module, ast} = nestedExample();
    const result = recoverClosureFactories(ast, module);
    expect(result.requiresOptimization2).toBe(true);
    const calls = objects(result.ast).filter(node => (node as {inlineForIdentity?: boolean}).inlineForIdentity);
    expect(calls).toHaveLength(2);
    for (const call of calls) expect((call as {args: unknown[]}).args).toEqual([]);
    expect(result.diagnostics.filter(d => d.code === 'closure-identity-native-inline')).toHaveLength(1);
    expect(result.diagnostics.some(d => d.message.includes('captured closure'))).toBe(true);
  });

  it('does not absorb a closed-chain capture that also escapes to unrelated code', () => {
    const {module, ast} = nestedExample();
    const site = objects(ast).find(node => (node as FunctionExpression).kind === 'function-expr' &&
      (node as FunctionExpression).closureIdentity?.ownerProtoId === module.mainProtoId &&
      (node as FunctionExpression).closureIdentity?.captureCount === 1) as FunctionExpression;
    const name = site.closureIdentity!.captureNames![0]!;
    ast.body.statements.push({kind: 'expression-stmt', expression: {
      kind: 'call', callee: ident('observe'), args: [ident(name)], open: false,
    }});
    const rejected = recoverClosureFactories(ast, module);
    expect(rejected.requiresOptimization2).toBe(false);
    expect(rejected.diagnostics.some(d => d.code === 'closure-identity-inline-unproved')).toBe(true);
  });
});
