// Add a split after an open producer and an unreachable predecessor to its
// consumer. The live path and dynamic stack top remain unchanged. Only the
// two authored straight-line forwarding helpers are transformed.
import {readFileSync, writeFileSync} from 'node:fs';
import {decodeBytecode} from '../../../dist/decode/Decoder.js';
import {writeBytecode} from '../../../dist/decode/BytecodeWriter.js';
import {encodeAd, Opcode} from '../../../dist/decode/Opcode.js';

const input = process.argv[2], output = process.argv[3];
if (!input || !output) throw new Error('Usage: node add-open-pack-dead-edge.mjs original.luauc output.luauc');
const module = decodeBytecode(readFileSync(input)).module;
const mapped = new Map();
const convert = id => {
  if (mapped.has(id)) return mapped.get(id);
  const proto = module.prototypes[id];
  let code = [...proto.code], locals = proto.locals;
  if (proto.debugName === 'inspect' || proto.debugName === 'forward') {
    if (proto.instructions.some(insn => insn.jumpTarget !== undefined)) throw new Error('Unexpected authored branch');
    const producer = proto.instructions.find(insn => proto.debugName === 'inspect'
      ? insn.opcode === Opcode.GETVARARGS && insn.b === 0
      : insn.opcode === Opcode.CALL && insn.c === 0);
    if (!producer) throw new Error('Missing authored open producer');
    const split = producer.pc + producer.width, consumerPc = split + 1;
    code = [...code.slice(0, split), encodeAd(Opcode.JUMP, 0, 0), ...code.slice(split)];
    code.push(encodeAd(Opcode.LOADN, 0, 17),
      encodeAd(Opcode.JUMP, 0, consumerPc - code.length - 2));
    locals = (proto.debugName === 'inspect' ? ['tag', 'counter'] : ['producer', 'value'])
      .map((name, register) => ({name, register, startPc: 0, endPc: code.length}));
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
