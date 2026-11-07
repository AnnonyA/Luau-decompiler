import {expect,it} from 'vitest';
import {abc,ad,compile,proto,Opcode,CaptureType} from './helpers.ts';
import {decompile} from '../src/decompile.ts';
import {analyzeBindings} from '../src/analysis/Bindings.ts';
it.each([false,true])('retains a private written capture for NEWCLOSURE instead of folding its value into the child (constant=%s)',constant=>{
 const factory=proto({maxStackSize:3,constants:[{kind:'string',value:'callback'}],
  children:[proto({maxStackSize:1,numUpvalues:1,instructions:[abc(Opcode.GETUPVAL,0,0),abc(Opcode.RETURN,0,2)]})],
  instructions:[...(constant?[ad(Opcode.LOADN,0,7)]:[abc(Opcode.GETGLOBAL,0),0]),ad(Opcode.NEWCLOSURE,1,0),abc(Opcode.CAPTURE,CaptureType.VAL,0),abc(Opcode.RETURN,1,2)]});
 const bytes=compile(proto({children:[factory],instructions:[ad(Opcode.NEWCLOSURE,0,0),abc(Opcode.RETURN,0,2)]}));
 const result=decompile(bytes);expect(result.ok).toBe(true);if(!result.ok)throw Error(result.error);
 const capture=analyzeBindings(result.ast.body).bindings.find(b=>b.captured && b.declaration.kind==='local');
 expect(capture).toBeDefined();expect(capture!.writes).toHaveLength(1);
 expect(capture!.declaration.kind==='local' && capture!.declaration.values).toEqual([]);
});
it('does not duplicate a factory\'s already lexical closure captures',async()=>{
 const {readFileSync}=await import('node:fs');
 const result=decompile(readFileSync(new URL('./fixtures/object-optimized/factory-many-captures-O1.luauc',import.meta.url)),{opcodeEncoding:'official'});
 expect(result.ok).toBe(true);if(!result.ok)throw Error(result.error);
 const fn=result.ast.body.statements.find(s=>s.kind==='function-decl' && s.name==='factory');
 if(fn?.kind!=='function-decl')throw Error('missing factory');
 // Ordinary call-result locals may remain; redundant private snapshots must not.
 expect(analyzeBindings(fn.body).bindings.filter(b=>b.scope===fn.body && /^captured\d*$/.test(b.name))).toHaveLength(0);
});

it('preserves a written REF capture even when its last stored value is constant',()=>{
 const factory=proto({maxStackSize:2,
  children:[proto({maxStackSize:1,numUpvalues:1,instructions:[abc(Opcode.GETUPVAL,0,0),abc(Opcode.RETURN,0,2)]})],
  instructions:[ad(Opcode.LOADN,0,0),ad(Opcode.LOADN,0,7),ad(Opcode.NEWCLOSURE,1,0),
    abc(Opcode.CAPTURE,CaptureType.REF,0),abc(Opcode.CLOSEUPVALS,0),abc(Opcode.RETURN,1,2)]});
 const bytes=compile(proto({children:[factory],instructions:[ad(Opcode.NEWCLOSURE,0,0),abc(Opcode.RETURN,0,2)]}));
 const result=decompile(bytes);expect(result.ok).toBe(true);if(!result.ok)throw Error(result.error);
 const capture=analyzeBindings(result.ast.body).bindings.find(b=>b.captured && b.declaration.kind==='local');
 expect(capture).toBeDefined();expect(capture!.writes.length).toBeGreaterThan(0);
});
