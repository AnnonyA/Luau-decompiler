import {it,expect} from 'vitest';
import {abc,ad,Opcode,proto,compile,ret} from './helpers.ts';
import {decodeBytecode} from '../src/decode/Decoder.ts';
import {analyzePrototype} from '../src/reconstruct/Reconstructor.ts';
it('keeps generic prep predecessors outside their own loop and retains the outer continuation',()=>{
 const {module}=decodeBytecode(compile(proto({instructions:[
  ad(Opcode.FORGPREP,0,6), ad(Opcode.FORGPREP,3,2),
  abc(Opcode.NOP,0,0,0),abc(Opcode.NOP,0,0,0),
  ad(Opcode.FORGLOOP,3,-3),1,
  abc(Opcode.NOP,0,0,0),
  ad(Opcode.FORGLOOP,0,-7),1,ret(),
 ]})),{opcodeEncoding:'official'});
 const ir=analyzePrototype(module.prototypes[module.mainProtoId]!);
 const inner=ir.loops.find(l=>ir.cfg.blocks[l.latch]!.startPc===4)!;
 expect(inner.blocks.map(id=>ir.cfg.blocks[id]!.startPc)).toEqual([2,4]);
 expect(ir.cfg.blocks[ir.structure.loopFollow.get(inner.header)!]!.startPc).toBe(6);
});
