import {writeFileSync} from 'node:fs';
const directory=process.argv[2], prefix=process.argv[3];
const {writeBytecode,abc,ad}=await import(directory+'/decode/BytecodeWriter.js');
const {Opcode}=await import(directory+'/decode/Opcode.js');
const {decodeBytecode}=await import(directory+'/decode/Decoder.js');
const {normalizeControlFlow}=await import(directory+'/decode/NormalizeControlFlow.js');
const body=[ad(Opcode.LOADN,0,3),ad(Opcode.LOADN,1,1),ad(Opcode.LOADN,2,1),ad(Opcode.FORNPREP,0,3),abc(Opcode.MOVE,3,2,0),ad(Opcode.JUMP,0,1),ad(Opcode.FORNLOOP,0,-3),abc(Opcode.LOADB,4,0,0),ad(Opcode.JUMPIFNOT,4,6),ad(Opcode.LOADN,0,3),ad(Opcode.LOADN,1,1),ad(Opcode.LOADN,2,1),ad(Opcode.FORNPREP,0,2),abc(Opcode.ADDK,3,3,0),ad(Opcode.FORNLOOP,0,-2),abc(Opcode.RETURN,3,2,0)];
const child={maxStackSize:8,numParams:0,numUpvalues:0,constants:[{kind:'number',value:1}],instructions:body};
const main={maxStackSize:8,numParams:0,numUpvalues:0,children:[child],constants:[{kind:'string',value:'print'}],instructions:[abc(Opcode.GETGLOBAL,0,0,0),0,ad(Opcode.NEWCLOSURE,1,0),abc(Opcode.CALL,1,1,0),abc(Opcode.CALL,0,0,1),abc(Opcode.RETURN,0,1,0)]};
const original=writeBytecode(main,{version:6,typesVersion:1});
const module=normalizeControlFlow(decodeBytecode(original).module);
function convert(id){const p=module.prototypes[id];return{maxStackSize:p.maxStackSize,numParams:p.numParams,numUpvalues:p.numUpvalues,children:p.childProtoIds.map(convert),constants:p.constants,instructions:[...p.code]};}
const normalized=writeBytecode(convert(module.mainProtoId),{version:6,typesVersion:1});
writeFileSync(prefix+'-original.luauc',original);writeFileSync(prefix+'-normalized.luauc',normalized);
console.log(JSON.stringify({mainProtoId:module.mainProtoId,childWords:module.prototypes[0].code.length,markers:module.prototypes[0].instructions.filter(i=>i.opcode===Opcode.FORNLOOP).map(i=>({pc:i.pc,originalPc:i.originalPc}))}));
