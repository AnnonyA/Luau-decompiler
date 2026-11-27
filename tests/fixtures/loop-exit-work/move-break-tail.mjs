// Compile the authored choose function first. Relocate its early-break work
// behind the numeric latch, preserving every jump edge and both exit paths.
import {readFileSync,writeFileSync} from 'node:fs';
import {decodeBytecode} from '../../../dist/decode/Decoder.js';
import {writeBytecode} from '../../../dist/decode/BytecodeWriter.js';
import {Opcode,encodeAd,encodeE} from '../../../dist/decode/Opcode.js';
const module=decodeBytecode(readFileSync(process.argv[2]),{opcodeEncoding:'official'}).module;
const mapped=new Map();
function convert(id) {
 if(mapped.has(id))return mapped.get(id);
 const p=module.prototypes[id];let code=[...p.code],locals=p.locals;
 if(p.debugName==='choose') {
  const prep=p.instructions.find(i=>i.opcode===Opcode.FORNPREP);
  const latch=p.instructions.find(i=>i.opcode===Opcode.FORNLOOP&&i.a===prep.a);
  const result=p.instructions.find(i=>i.opcode===Opcode.LOADNIL).a;
  const first=p.instructions.find(i=>i.pc>prep.pc&&i.pc<latch.pc&&i.opcode===Opcode.MOVE&&i.a===result);
  const last=p.instructions.find(i=>i.pc>first.pc&&i.opcode===Opcode.JUMP&&i.jumpTarget===prep.jumpTarget);
  if(!first||!last||last.pc>=latch.pc)throw Error('Unexpected authored break tail');
  const moved=p.instructions.filter(i=>i.pc>=first.pc&&i.pc<=last.pc);
  const items=[...p.instructions.filter(i=>i.pc<first.pc),{kind:'entry'},...p.instructions.filter(i=>i.pc>last.pc&&i.pc<=latch.pc),{kind:'bypass'},...moved,...p.instructions.filter(i=>i.pc>latch.pc)];
  const positions=new Map(),synthetic=new Map();let pc=0;
  for(const i of items){if(i.kind){synthetic.set(i.kind,pc);pc++}else{positions.set(i.pc,pc);pc+=i.width}}
  const target=(old)=>old===first.pc?synthetic.get('entry'):positions.get(old);
  code=[];
  for(const i of items){const at=code.length;
   if(i.kind){const to=i.kind==='entry'?positions.get(first.pc):target(prep.jumpTarget);code.push(encodeAd(Opcode.JUMP,0,to-at-1));continue}
   let word=i.rawWord;
   if(i.jumpTarget!==undefined){const to=target(i.jumpTarget);if(to===undefined)throw Error('Unmapped jump');word=i.opcode===Opcode.JUMPX?encodeE(i.opcode,to-at-1):encodeAd(i.opcode,i.a,to-at-1)}
   code.push(word);if(i.width===2)code.push(i.aux);
  }
  locals=[{name:'limit',register:0,startPc:0,endPc:code.length}];
 }
 const result={...p,instructions:code,locals,constants:p.constants.map(c=>({...c})),children:p.childProtoIds.map(convert)};mapped.set(id,result);return result;
}
const main=convert(module.mainProtoId),order=[];
const collect=p=>{for(const c of p.children)collect(c);order.push(p)};collect(main);
const ids=new Map(order.map((p,i)=>[p,i]));
for(const p of mapped.values())for(const c of p.constants)if(c.kind==='closure')c.protoId=ids.get(mapped.get(c.protoId));
writeFileSync(process.argv[3],writeBytecode(main,{version:module.version,typesVersion:module.typesVersion}));
