import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {decompile} from '../src/decompile.ts';
import {analyzePrototype} from '../src/reconstruct/Reconstructor.ts';
import {Opcode} from '../src/decode/Opcode.ts';
const bytes=(name:string,level:number)=>readFileSync(new URL(`fixtures/rewrites/${name}-O${level}.luauc`,import.meta.url));
it.each([0,1,2])('keeps both periodic-task guard edges inside the loop at O%i',level=>{
 const result=decompile(bytes('guarded-polling',level),{opcodeEncoding:'official'});
 expect(result.ok).toBe(true);if(!result.ok)throw Error(result.error);
 expect(result.source).toContain('while true do');expect(result.source).not.toMatch(/\bbreak\b/);
 const periodic=result.module.prototypes.find(p=>p.constants.some(k=>k.kind==='string' && k.value==='yield'))!;
 const ir=analyzePrototype(periodic);
 const loop=ir.loops.find(l=>ir.cfg.blocks[l.header]!.startPc===0)!;
 expect(loop).toBeDefined();
 // O0 retains LOADB true + a syntactic exit edge; optimized headers instead
 // branch only within the loop and must not be interpreted as exit tests.
 if(level>0)expect(loop.kind).toBe('infinite');
});
it('does not discard and then repeat arguments consumed by generic FASTCALL',()=>{
 const result=decompile(bytes('fastcall-observations',1),{opcodeEncoding:'official',recoverInlinedFunctions:false});
 expect(result.ok).toBe(true);if(!result.ok)throw Error(result.error);
 expect(result.module.prototypes.some(p=>p.instructions.some(i=>i.opcode===Opcode.FASTCALL))).toBe(true);
 // Three min operations in combined plus the one variadic minimum.
 expect(result.source.match(/math\.min\(/g)).toHaveLength(4);
 expect(result.source.match(/\bobserve\(/g)).toHaveLength(9); // declaration and eight calls
});
it.each([0,1,2])('evaluates each generic/numeric loop input exactly once at O%i',level=>{
 const result=decompile(bytes('loop-input-observations',level),{opcodeEncoding:'official'});
 expect(result.ok).toBe(true);if(!result.ok)throw Error(result.error);
 for(const field of ['entries','first','last','step'])expect(result.source.match(new RegExp('\\.'+field+'\\b','g'))).toHaveLength(1);
});
