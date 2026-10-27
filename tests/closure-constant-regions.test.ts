import {findCyclicBlocks} from '../src/cfg/Cycles.ts';
import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {decompile} from '../src/decompile.ts';
function source(name:string){const r=decompile(readFileSync(new URL(`./fixtures/object-optimized/${name}-O2.luauc`,import.meta.url)),{opcodeEncoding:'official'});expect(r.ok).toBe(true);if(!r.ok)throw Error(r.error);expect(r.validation).toEqual([]);return r.source;}
it('reuses one closure with stable table capture instead of cloning its body',()=>{
 const code=source('stable-capture-constant');
 expect(code.match(/return .*\.bias/g)).toHaveLength(2); // factory body + one shared inlined body
 expect(code).toMatch(/\bsharedFunction\b/);
});
it('declares a shared constant outside the conditional use',()=>{
 const code=source('branch-closure-constant');
 expect(code.match(/return .* \+ 1/g)).toHaveLength(2);
 expect(code).toMatch(/\bsharedFunction\b/);
});
it('does not share closures whose captures differ',()=>{
 expect(source('different-closure-captures')).not.toMatch(/\bsharedFunction\b/);
});

import {abc,ad,compile,proto,Opcode,CaptureType} from './helpers.ts';
import {decodeBytecode} from '../src/decode/Decoder.ts';
import {analyzePrototype} from '../src/reconstruct/Reconstructor.ts';
it('distinguishes versions of the same captured register in SSA',()=>{
 const bytes=compile(proto({maxStackSize:4,children:[proto({numUpvalues:1,instructions:[abc(Opcode.GETUPVAL,0,0),abc(Opcode.RETURN,0,2)]})],
  constants:[{kind:'closure',protoId:0}],instructions:[ad(Opcode.LOADN,0,3),ad(Opcode.DUPCLOSURE,1,0),abc(Opcode.CAPTURE,CaptureType.VAL,0),
   ad(Opcode.LOADN,0,7),ad(Opcode.DUPCLOSURE,2,0),abc(Opcode.CAPTURE,CaptureType.VAL,0),abc(Opcode.RETURN,1,3)]}));
 const {module}=decodeBytecode(bytes);const p=module.prototypes[module.mainProtoId]!;const ir=analyzePrototype(p);
 const values=p.instructions.filter(i=>i.opcode===Opcode.CAPTURE).map(i=>ir.ssa.useAt.get(`${ir.cfg.blockOfPc.get(i.pc)}:${i.pc}:0`));
 expect(values.every(v=>v!==undefined)).toBe(true);expect(values[0]).not.toBe(values[1]);
 const r=decompile(bytes);expect(r.ok).toBe(true);if(r.ok)expect(r.source).not.toContain('sharedFunction');
});

it('does not treat an irreducible cyclic capture region as a single activation',()=>{
 const bytes=compile(proto({maxStackSize:4,isVararg:true,children:[proto({numUpvalues:1,instructions:[abc(Opcode.GETUPVAL,0,0),abc(Opcode.RETURN,0,2)]})],
 constants:[{kind:'closure',protoId:0},{kind:'number',value:1}],instructions:[
 ad(Opcode.LOADN,0,3),abc(Opcode.GETVARARGS,1,2),ad(Opcode.JUMPIF,1,6),
 ad(Opcode.DUPCLOSURE,2,0),abc(Opcode.CAPTURE,CaptureType.VAL,0),ad(Opcode.DUPCLOSURE,3,0),abc(Opcode.CAPTURE,CaptureType.VAL,0),
 ad(Opcode.JUMPIF,1,1),ad(Opcode.JUMP,0,3),abc(Opcode.ADDK,0,0,1),ad(Opcode.JUMPIFNOT,1,-8),ad(Opcode.JUMP,0,0),abc(Opcode.RETURN,2,3)]}));
 const {module}=decodeBytecode(bytes);const ir=analyzePrototype(module.prototypes[module.mainProtoId]!);
 expect(findCyclicBlocks(ir.cfg)).toEqual(new Set([ir.cfg.blockOfPc.get(3),ir.cfg.blockOfPc.get(9)]));
 expect(ir.loops).toHaveLength(0); // two entries: natural-loop detection alone cannot prove single execution
 const result=decompile(bytes);expect(result.ok).toBe(true);
 if(result.ok)expect(result.source).not.toContain('sharedFunction');
});
