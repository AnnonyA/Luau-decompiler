import {it,expect} from 'vitest';
import {chunk,block,ident,lit,type Statement} from '../src/ast/Ast.ts';
import {cleanupAst} from '../src/ast/AstCleanup.ts';
import {printLuau} from '../src/print/LuauPrinter.ts';
import {analyzeBindings} from '../src/analysis/Bindings.ts';
it('renames a lifted receiver inside generic loops and captured closures',()=>{
 const statements:Statement[]=[{kind:'local',names:['object'],values:[{kind:'table',fields:[]}]},
 {kind:'local',names:['release'],values:[{kind:'function-expr',params:['receiver'],isVararg:false,body:block([
  {kind:'generic-for',names:['k','v'],iterators:[{kind:'call',callee:ident('ipairs'),args:[{kind:'property',object:ident('receiver'),name:'items'}],open:false}],body:block([
   {kind:'expression-stmt',expression:{kind:'call',callee:ident('print'),args:[ident('v')],open:false}}])},
  {kind:'return',values:[{kind:'function-expr',params:[],isVararg:false,body:block([{kind:'return',values:[ident('receiver')]}])}]}
 ])}]},
 {kind:'assign',targets:[{kind:'property',object:ident('object'),name:'release'}],values:[ident('release')]},
 {kind:'return',values:[ident('object')]}];
 const ast=cleanupAst(chunk(statements),{typeAnnotations:'off',ifExpressions:false,earlyReturn:false,interpolatedStrings:false,mathConstants:false});
 expect(printLuau(ast)).toContain(':release()');
 expect(analyzeBindings(ast.body).globals.has('receiver')).toBe(false);
});

it('keeps a nested constructor identity when its register is reused',async()=>{
 const {proto,abc,ad,Opcode,sourceOf}=await import('./helpers.ts');
 const source=sourceOf(proto({constants:[{kind:'string',value:'items'}],instructions:[
  abc(Opcode.NEWTABLE,0,1,0),0,abc(Opcode.NEWTABLE,1,0,0),0,
  abc(Opcode.SETTABLEKS,1,0,0),0,abc(Opcode.LOADB,1,0,0),abc(Opcode.RETURN,0,2,0)]}));
 expect(source).not.toMatch(/config\d* = false/);
 expect(source).toMatch(/items = \{\}/);
});
it('does not overwrite constructor locals when assigning unrelated register values',async()=>{
 const {readFileSync}=await import('node:fs');
 const {decompile}=await import('../src/decompile.ts');
 const result=decompile(readFileSync(new URL('./fixtures/large/constructor-lifetime.luauc',import.meta.url)),{opcodeEncoding:'official'});
 expect(result.ok).toBe(true);
 if(!result.ok)return;
 const bindings=analyzeBindings(result.ast.body).bindings;
 const tableBindings=bindings.filter(b=>b.declaration.kind==='local'&&b.declaration.values.some(v=>v.kind==='table'));
 expect(tableBindings.filter(b=>b.writes.length>0).map(b=>b.name)).toEqual([]);
});
it('keeps a shared nonterminal alternative reachable from both guards',async()=>{
 const {readFileSync}=await import('node:fs');
 const {decompile}=await import('../src/decompile.ts');
 const {reconstructFunction}=await import('../src/reconstruct/Reconstructor.ts');
 const result=decompile(readFileSync(new URL('./fixtures/large/shared-alternative.luauc',import.meta.url)),{opcodeEncoding:'official'});
 expect(result.ok).toBe(true);if(!result.ok)return;
 const p=result.module.prototypes.find(p=>p.debugName==='run')!;
 const fn=reconstructFunction(result.module,p);
 // Evaluate the small branch-only regression's AST, including every boolean
 // input combination. This checks behavior without asserting one source shape.
 for(const a of [false,true])for(const b of [false,true])for(const c of [false,true]){
  const env=new Map(fn.params.map((p,i)=>[p,[a,b,c][i]]));const output:unknown[]=[];
  const expr=(e:any):any=>{switch(e.kind){
   case 'identifier':return env.get(e.name);
   case 'literal':return e.value;
   case 'unary':expect(e.op).toBe('not');return !expr(e.argument);
   case 'binary':if(e.op==='and')return expr(e.left)&&expr(e.right);if(e.op==='or')return expr(e.left)||expr(e.right);throw Error(e.op);
   default:throw Error(e.kind);
  }};
  const walk=(body:any):void=>{for(const s of body.statements){
   if(s.kind==='if'){if(expr(s.test))walk(s.consequent);else{const branch=s.branches.find((b:any)=>expr(b.test));if(branch)walk(branch.body);else if(s.alternate)walk(s.alternate);}}
   else if(s.kind==='expression-stmt'){expect(s.expression.callee.name).toBe('print');output.push(...s.expression.args.map(expr));}
   else if(s.kind==='return'){expect(s.values).toEqual([]);return;}
   else throw Error(s.kind);
  }};
  walk(fn.body);expect(output).toEqual([...(a&&b?['both']:c?['fallback']:[]),'done']);
 }
});
it('does not jump past effectful latch instructions when joining loop branches',async()=>{
 const {readFileSync}=await import('node:fs');const {decompile}=await import('../src/decompile.ts');
 const result=decompile(readFileSync(new URL('./fixtures/large/effectful-latch.luauc',import.meta.url)),{opcodeEncoding:'official'});
 expect(result.ok).toBe(true);if(!result.ok)return;
 expect(result.source).not.toContain('continue');
 expect(result.source).toContain('"tail"');
});

it('keeps simultaneous accumulators distinct through compound assignments',()=>{
 const ast=cleanupAst(chunk([
  {kind:'local',names:['result0'],values:[lit(0)]},
  {kind:'local',names:['result1'],values:[lit(0)]},
  {kind:'local',names:['result2'],values:[lit(0)]},
  {kind:'compound-assign',target:ident('result1'),op:'+',value:lit(2)},
  {kind:'compound-assign',target:ident('result2'),op:'+',value:lit(7)},
  {kind:'return',values:[ident('result1'),ident('result2')]},
 ]),{typeAnnotations:'off'});
 const returned=ast.body.statements.find(s=>s.kind==='return')!;
 expect(returned.kind).toBe('return');if(returned.kind!=='return')return;
 expect(returned.values[0]).not.toEqual(returned.values[1]);
});
it('does not recycle an accumulator captured by an earlier closure',()=>{
 const ast=cleanupAst(chunk([
  {kind:'local',names:['result1'],values:[lit(0)]},
  {kind:'local',names:['read'],values:[{kind:'function-expr',params:[],isVararg:false,body:block([{kind:'return',values:[ident('result1')]}])}]},
  {kind:'local',names:['result2'],values:[lit(0)]},
  {kind:'compound-assign',target:ident('result2'),op:'+',value:lit(7)},
  {kind:'return',values:[ident('read'),ident('result2')]},
 ]),{typeAnnotations:'off'});
 const captured=analyzeBindings(ast.body).bindings.filter(b=>b.captured);
 expect(captured).toHaveLength(1);
 expect(captured[0]!.writes).toHaveLength(0);
});
it('snapshots a mutable upvalue before an intervening loop writes it',async()=>{
 const {readFileSync}=await import('node:fs');const {decompile}=await import('../src/decompile.ts');
 const result=decompile(readFileSync(new URL('./fixtures/large/upvalue-snapshot.luauc',import.meta.url)),{opcodeEncoding:'official'});
 expect(result.ok).toBe(true);if(!result.ok)return;
 const returns:Statement[]=[];
 const visit=(value:any):void=>{if(!value||typeof value!=='object')return;if(value.kind==='return')returns.push(value);Object.values(value).forEach(visit);};
 visit(result.ast);
 const pair=returns.find(s=>s.kind==='return'&&s.values.length===2)!;
 expect(pair).toBeDefined();if(pair.kind!=='return')return;
 expect(pair.values[0]).not.toEqual(pair.values[1]);
});
it('does not revive a discarded method call as a later loop phi initializer',async()=>{
 const {readFileSync}=await import('node:fs');const {decompile}=await import('../src/decompile.ts');
 const result=decompile(readFileSync(new URL('./fixtures/large/loop-call-lifetime.luauc',import.meta.url)),{opcodeEncoding:'official'});
 expect(result.ok).toBe(true);if(!result.ok)return;
 expect(result.source).not.toMatch(/:add\(\)/);
 expect(result.source.match(/:add\(/g)).toHaveLength(3); // declaration and two original calls
});
it('hoists a loop value read after the loop even when every iteration overwrites it',async()=>{
 const {readFileSync}=await import('node:fs');const {decompile}=await import('../src/decompile.ts');
 const result=decompile(readFileSync(new URL('./fixtures/large/loop-exit-binding.luauc',import.meta.url)),{opcodeEncoding:'official'});
 expect(result.ok).toBe(true);if(!result.ok)return;
 expect([...analyzeBindings(result.ast.body).globals]).toEqual(['print']);
});
