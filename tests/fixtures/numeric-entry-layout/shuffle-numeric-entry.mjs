import {readFileSync, writeFileSync} from 'node:fs';
import {decodeBytecode} from '../../../dist/decode/Decoder.js';
import {writeBytecode} from '../../../dist/decode/BytecodeWriter.js';
import {encodeAd, Opcode} from '../../../dist/decode/Opcode.js';
const module = decodeBytecode(readFileSync(process.argv[2])).module;
const mapped = new Map();
const convert = id => {
  if (mapped.has(id)) return mapped.get(id);
  const proto = module.prototypes[id];
  let code = [...proto.code], locals = proto.locals;
  if (proto.debugName === 'collect') {
    const prep = proto.instructions.find(i => i.opcode === Opcode.FORNPREP);
    const latch = proto.instructions.find(i => i.opcode === Opcode.FORNLOOP && i.a === prep?.a);
    if (!prep || !latch) throw new Error('Expected authored numeric iterator pair');
    const prefix = code.slice(0, prep.pc + prep.width), body = code.slice(prep.pc + prep.width, latch.pc), suffix = code.slice(latch.pc + latch.width);
    if (proto.instructions.filter(i => i.jumpTarget !== undefined).length !== 2) throw new Error('Unexpected authored branching');
    const entryPc = prefix.length, suffixPc = entryPc + 1, latchPc = suffixPc + suffix.length, bodyPc = latchPc + 2;
    prefix[prep.pc] = encodeAd(prep.opcode, prep.a, suffixPc - prep.pc - 1);
    code = [...prefix, encodeAd(Opcode.JUMP,0,bodyPc-entryPc-1), ...suffix,
      encodeAd(latch.opcode,latch.a,bodyPc-latchPc-1), encodeAd(Opcode.JUMP,0,suffixPc-latchPc-2), ...body,
      encodeAd(Opcode.JUMP,0,latchPc-bodyPc-body.length-1)];
    locals = [{name:'limit',register:0,startPc:0,endPc:code.length}];
  }
  const result = {...proto, instructions:code, locals, constants:proto.constants.map(c=>({...c})), children:proto.childProtoIds.map(convert)};
  mapped.set(id,result); return result;
};
const main = convert(module.mainProtoId), order=[];
const collect = p => {for(const child of p.children)collect(child);order.push(p);}; collect(main);
const ids = new Map(order.map((p,i)=>[p,i]));
for(const p of mapped.values())for(const c of p.constants)if(c.kind==='closure')c.protoId=ids.get(mapped.get(c.protoId));
writeFileSync(process.argv[3],writeBytecode(main,{version:module.version,typesVersion:1}));
