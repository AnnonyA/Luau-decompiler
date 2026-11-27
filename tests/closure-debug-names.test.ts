import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {decompile} from '../src/decompile.ts';
import {analyzeBindings} from '../src/analysis/Bindings.ts';
import {printWithoutCallBoundaries} from './helpers.ts';
import type {AstNode, Expression, FunctionDeclaration, FunctionExpression} from '../src/ast/Ast.ts';
it.each([0,1,2])('protects a prototype name from earlier fallback temporaries at O%s',level=>{
  const bytes=readFileSync(new URL(`./fixtures/rewrites/reassigned-function-name-O${level}.luauc`,import.meta.url));
  const result=decompile(bytes,{opcodeEncoding:'official'});
  expect(result.ok).toBe(true);
  if(!result.ok)throw Error(result.error);
  expect(result.source).toContain('local function result()');
  expect(printWithoutCallBoundaries(result.ast).match(/debug\.info\(result, "n"\)/g)).toHaveLength(2);
  const calls:any[]=[];
  const visit=(node:any):void=>{
    if(!node||typeof node!=='object')return;
    if(node.kind==='call'&&node.callee.kind==='property'&&node.callee.name==='info'&&node.callee.object.name==='debug')calls.push(node);
    Object.values(node).forEach(value=>Array.isArray(value)?value.forEach(visit):visit(value));
  };
  visit(result.ast);
  expect(calls).toHaveLength(2);
  const bindings=analyzeBindings(result.ast.body).bindings;
  const named=bindings.find(binding=>binding.declaration.kind==='function-decl'&&binding.name==='result');
  expect(named).toBeDefined();
  for(const call of calls)expect(bindings.find(binding=>binding.reads.some(read=>read.node===call.args[0]))).toBe(named);
  // O0 reaches debug.info through GETTABLEKS; retain both indirect CALLs.
  if(level===0)expect(result.source.match(/\(debug\.info\)\(result, "n"\)/g)).toHaveLength(2);
});

// The immutable originals first exposed a pre-existing debug-name regression.
// The runtime evidence next to them checks both empty and named observations;
// this also makes the anonymous-prototype invariant a regular unit gate.
it.each(["O0g1", "O0g2", "O1g1", "O1g2", "O2g1", "O2g2"])(
  'keeps a table closure anonymous through all presentation passes at %s', profile => {
    const bytes = readFileSync(new URL(
      `../benchmarks/results/table-key-presentation-2026-11-27/${profile}.luauc`, import.meta.url));
    const result = decompile(bytes, {opcodeEncoding: 'official', runtimeContext: false});
    expect(result.ok).toBe(true);
    if (!result.ok) throw Error(result.error);
    const functions: Array<FunctionExpression | FunctionDeclaration> = [];
    const walk = (value: unknown): void => {
      if (!value || typeof value !== 'object') return;
      const node = value as AstNode;
      if (node.kind === 'function-expr' || node.kind === 'function-decl') functions.push(node);
      Object.values(value).forEach(child => Array.isArray(child) ? child.forEach(walk) : walk(child));
    };
    walk(result.ast);
    const returnsOffset = (value: FunctionExpression | FunctionDeclaration, offset: number): boolean =>
      value.body.statements.some(statement => statement.kind === 'return' && statement.values.some(
        (expression: Expression) => expression.kind === 'binary' && expression.op === '+' &&
          expression.right.kind === 'literal' && expression.right.value === offset));
    const anonymous = functions.filter(value => returnsOffset(value, 3));
    expect(anonymous).toHaveLength(1);
    expect(anonymous[0]!.kind).toBe('function-expr');
    if (anonymous[0]!.kind !== 'function-expr') throw Error('anonymous prototype was named');
    expect(anonymous[0]!.debugName).toBeUndefined();
    expect(anonymous[0]!.creationSite).toBeDefined();
    expect(functions.filter(value => returnsOffset(value, 7))).toHaveLength(1);
  });
