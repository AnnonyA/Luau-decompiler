// Run after building. This authored walk function has one simple generic loop.
// Move its continuation before the body while preserving every control edge.
// A whole-function parameter range keeps this valid layout visible to the
// reconstruction stage instead of allowing layout normalization to undo it.
import {readFileSync, writeFileSync} from 'node:fs';
import {decodeBytecode} from '../../../dist/decode/Decoder.js';
import {writeBytecode} from '../../../dist/decode/BytecodeWriter.js';
import {encodeAd, Opcode} from '../../../dist/decode/Opcode.js';

const input = process.argv[2], output = process.argv[3];
if (!input || !output) throw new Error('Usage: node shuffle-iterator-follow.mjs original.luauc output.luauc');
const module = decodeBytecode(readFileSync(input)).module;
const mapped = new Map();
const convert = id => {
  if (mapped.has(id)) return mapped.get(id);
  const proto = module.prototypes[id];
  let code = [...proto.code], locals = proto.locals;
  if (proto.debugName === 'walk') {
    const prep = proto.instructions.find(insn => insn.opcode === Opcode.FORGPREP);
    const latch = proto.instructions.find(insn => insn.pc === prep?.jumpTarget);
    if (!prep || latch?.opcode !== Opcode.FORGLOOP ||
        proto.instructions.filter(insn => insn.jumpTarget !== undefined).length !== 2) {
      throw new Error('Unexpected authored walk control flow');
    }
    const prefix = code.slice(0, prep.pc + prep.width);
    const body = code.slice(prep.pc + prep.width, latch.pc);
    const suffix = code.slice(latch.pc + latch.width);
    const suffixPc = prefix.length + 1;
    const bodyPc = suffixPc + suffix.length, latchPc = bodyPc + body.length;
    prefix[prep.pc] = encodeAd(prep.opcode, prep.a, latchPc - prep.pc - 1);
    code = [...prefix, encodeAd(Opcode.JUMP, 0, bodyPc - prefix.length - 1),
      ...suffix, ...body, encodeAd(latch.opcode, latch.a, bodyPc - latchPc - 1), latch.aux,
      encodeAd(Opcode.JUMP, 0, suffixPc - (latchPc + latch.width) - 1)];
    locals = [{name: 'items', register: 0, startPc: 0, endPc: code.length}];
  }
  const result = {...proto, instructions: code, locals,
    constants: proto.constants.map(constant => ({...constant})), children: proto.childProtoIds.map(convert)};
  mapped.set(id, result);
  return result;
};
const main = convert(module.mainProtoId), order = [];
const collect = proto => {for (const child of proto.children) collect(child); order.push(proto);};
collect(main);
const ids = new Map(order.map((proto, id) => [proto, id]));
for (const proto of mapped.values()) for (const constant of proto.constants) {
  if (constant.kind === 'closure') constant.protoId = ids.get(mapped.get(constant.protoId));
}
writeFileSync(output, writeBytecode(main, {version: module.version, typesVersion: module.typesVersion}));
