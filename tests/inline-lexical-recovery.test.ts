import {expect, it} from 'vitest';
import {block, chunk, ident, lit, type Expression, type Statement} from '../src/ast/Ast.ts';
import {recoverInlineCalls} from '../src/reconstruct/InlineRecovery.ts';
import {printLuau} from '../src/print/LuauPrinter.ts';
import {readFileSync} from 'node:fs';
import {decompile} from '../src/decompile.ts';

const formula = (value: Expression): Expression => ({kind:'binary',op:'+',
  left:{kind:'binary',op:'*',left:value,right:lit(7)},right:lit(3)});
const helper = (): Statement => ({kind:'function-decl',local:true,name:'weighted',params:['value'],
  isVararg:false,line:1,body:block([{kind:'return',values:[formula(ident('value'))]}])});
const score = (value: Expression): Statement => ({kind:'local',names:['score'],values:[value]});
const loop = (): Statement => ({kind:'numeric-for',name:'index',start:lit(1),stop:lit(8),body:block([score(formula(ident('index')))])});
const consumer = (body: Statement[], params: string[] = []): Extract<Statement,{kind:'function-decl'}> =>
  ({kind:'function-decl',local:true,name:'consume',params,isVararg:false,body:block(body)});
const keepHelper = (): Statement => ({kind:'return',values:[ident('weighted')]});
function run(statements: Statement[]): string {
  const ast=chunk(statements),before=structuredClone(ast);
  const result=recoverInlineCalls(ast,new Set([1]));
  expect(ast).toEqual(before);
  return printLuau(result);
}

it('recovers an outer helper already captured by a named consumer',()=>{
  expect(run([helper(),consumer([loop(),keepHelper()])])).toContain('weighted(index)');
});
it('recovers an outer helper already captured by an anonymous consumer',()=>{
  const fn=consumer([loop(),keepHelper()]);
  expect(run([helper(),{kind:'local',names:['callback'],values:[{
    kind:'function-expr',params:[],isVararg:false,body:fn.body,
  }]}])).toContain('weighted(index)');
});
it('keeps a numeric capture as the recovered argument',()=>{
  expect(run([{kind:'local',names:['base'],values:[lit(4)]},helper(),
    consumer([score(formula(ident('base'))),keepHelper()])])).toContain('weighted(base)');
});
it('does not add a helper capture to a closure that did not retain it',()=>{
  expect(run([helper(),consumer([loop()])])).not.toContain('weighted(index)');
});
it('does not call a helper shadowed by a parameter or the consumer itself',()=>{
  expect(run([helper(),consumer([loop(),keepHelper()],['weighted'])])).not.toContain('weighted(index)');
  expect(run([helper(),{...consumer([loop(),keepHelper()]),name:'weighted'}])).not.toContain('weighted(index)');
});
it('does not extract an initializer that changes which lexical cell a closure captures',()=>{
  const partial: Expression={kind:'binary',op:'*',left:ident('base'),right:lit(7)};
  const value: Expression={kind:'binary',op:'+',left:ident('partial'),right:lit(3)};
  expect(run([{kind:'local',names:['base'],values:[lit(4)]},
    {kind:'local',names:['partial'],values:[partial]},helper(),
    consumer([score(value),keepHelper()])])).not.toContain('weighted(base)');
});
it('does not inherit a helper assigned after a closure was created',()=>{
  const fn=helper() as Extract<Statement,{kind:'function-decl'}>;
  expect(run([{kind:'local',names:['weighted'],values:[]},consumer([loop(),keepHelper()]),
    {kind:'assign',targets:[ident('weighted')],values:[{...fn,kind:'function-expr'}]}])).not.toContain('weighted(index)');
});
it('does not inherit a helper reassigned through a captured cell',()=>{
  expect(run([helper(),consumer([loop(),keepHelper()]),
    consumer([{kind:'assign',targets:[ident('weighted')],values:[lit(null)]}])])).not.toContain('weighted(index)');
});

it('restores retained scalar and tuple helpers in official O2 nested consumers',()=>{
  const bytes=readFileSync(new URL('./fixtures/rewrites/inlined-lexical-helpers-O2.luauc',import.meta.url));
  const result=decompile(bytes,{opcodeEncoding:'official'});
  expect(result.ok).toBe(true);if(!result.ok)throw Error(result.error);
  expect(result.validation).toEqual([]);
  // The two cached closure loads now use one literal behind a factory;
  // its helper call is printed once rather than duplicating the closure body.
  expect(result.source.match(/weighted\((?:index|i)\)/g)).toHaveLength(4);
  expect(result.source.match(/closureFactory\(\)/g)).toHaveLength(3); // declaration and both loads
  expect(result.source).toContain('measure(index)');
  const disabled=decompile(bytes,{opcodeEncoding:'official',recoverInlinedFunctions:false});
  expect(disabled.ok).toBe(true);if(!disabled.ok)throw Error(disabled.error);
  expect(disabled.source).not.toMatch(/weighted\((?:index|i)\)/);
  expect(disabled.source).not.toContain('measure(index)');
});
