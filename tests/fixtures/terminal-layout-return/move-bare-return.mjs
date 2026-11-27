import {readFileSync,writeFileSync} from 'node:fs';
import {decodeBytecode} from '../../../dist/decode/Decoder.js';
import {writeBytecode} from '../../../dist/decode/BytecodeWriter.js';
import {Opcode,encodeAd} from '../../../dist/decode/Opcode.js';
const module=decodeBytecode(readFileSync(process.argv[2])).module,mapped=new Map();
const convert=id=>{
 if(mapped.has(id))return mapped.get(id);
 const p=module.prototypes[id];let code=[...p.code],locals=p.locals;
 if(p.debugName==='route'){
  const ret=p.instructions.find(i=>i.opcode===Opcode.RETURN&&i.b===1);
  if(!ret||ret.pc===code.length-1)throw new Error('Expected early bare return');
  code[ret.pc]=encodeAd(Opcode.JUMP,0,code.length-ret.pc-1);code.push(ret.rawWord);
  locals=[{name:'items',register:0,startPc:0,endPc:code.length}];
 }
 const result={...p,instructions:code,locals,upvalueNames:locals.length?Array.from({length:p.numUpvalues},(_,i)=>p.upvalueNames[i]??`captured${i}`):p.upvalueNames,constants:p.constants.map(c=>({...c})),children:p.childProtoIds.map(convert)};
 mapped.set(id,result);return result;
};
const main=convert(module.mainProtoId),order=[];const collect=p=>{for(const child of p.children)collect(child);order.push(p);};collect(main);
const ids=new Map(order.map((p,i)=>[p,i]));for(const p of mapped.values())for(const c of p.constants)if(c.kind==='closure')c.protoId=ids.get(mapped.get(c.protoId));
writeFileSync(process.argv[3],writeBytecode(main,{version:module.version,typesVersion:1}));
