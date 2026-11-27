import {readFileSync,writeFileSync} from 'node:fs';
import {decodeBytecode} from '../../../dist/decode/Decoder.js';
import {writeBytecode} from '../../../dist/decode/BytecodeWriter.js';
import {Opcode,encodeAd,encodeE,isFastCall} from '../../../dist/decode/Opcode.js';
import {analyzePrototype} from '../../../dist/reconstruct/Reconstructor.js';
const module=decodeBytecode(readFileSync(process.argv[2])).module,mapped=new Map();
const convert=id=>{
 if(mapped.has(id))return mapped.get(id);
 const p=module.prototypes[id],ir=analyzePrototype(p),at=new Set();
 if(p.debugName==='search'||p.debugName==='choose')for(const loop of ir.loops)for(const block of ir.cfg.blocks){
  if(!loop.blocks.includes(block.id)||block.successors.length!==2)continue;
  const follow=ir.structure.loopFollowByLoop.get(loop);
  for(const next of block.successors){const target=ir.cfg.blocks[next];
   if(!loop.blocks.includes(next)&&next!==follow&&target.instructions.at(-1)?.opcode===Opcode.RETURN)at.add(target.startPc);
  }
 }
 const entry=new Map(),actual=new Map();let size=0;
 for(const i of p.instructions){entry.set(i.pc,size);if(at.has(i.pc))size++;actual.set(i.pc,size);size+=i.width;}
 entry.set(p.code.length,size);actual.set(p.code.length,size);
 const code=[];
 for(const i of p.instructions){if(at.has(i.pc))code.push(encodeAd(Opcode.JUMP,0,0));let word=i.rawWord;
  if(i.jumpTarget!==undefined){const offset=entry.get(i.jumpTarget)-actual.get(i.pc)-1;
   if(!Number.isInteger(offset))throw new Error('bad target');
   if(isFastCall(i.opcode)||i.opcode===Opcode.FINCONSTRUCT)word=(word&0x00ffffff)|((offset-1)<<24);
   else if(i.opcode===Opcode.LOADB)word=(word&0x00ffffff)|(offset<<24);
   else if(i.opcode===Opcode.JUMPX)word=encodeE(i.opcode,offset);
   else word=encodeAd(i.opcode,i.a,offset);
  }
  code.push(word>>>0);if(i.width===2)code.push(i.aux);
 }
 const result={...p,instructions:code,locals:p.locals.map(l=>({...l,startPc:entry.get(l.startPc),endPc:entry.get(l.endPc)})),constants:p.constants.map(c=>({...c})),children:p.childProtoIds.map(convert)};
 mapped.set(id,result);return result;
};
const main=convert(module.mainProtoId),order=[];const collect=p=>{for(const child of p.children)collect(child);order.push(p);};collect(main);
const ids=new Map(order.map((p,i)=>[p,i]));for(const p of mapped.values())for(const c of p.constants)if(c.kind==='closure')c.protoId=ids.get(mapped.get(c.protoId));
writeFileSync(process.argv[3],writeBytecode(main,{version:module.version,typesVersion:1}));
