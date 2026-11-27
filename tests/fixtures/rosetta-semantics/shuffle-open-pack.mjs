// Run after building and compiling open-pack-linear-chain.luau into the six
// O0/O1/O2 g1/g2 bytecode files beside this script. Only the authored carry
// function is permuted: its consumer block precedes its producer physically,
// while two unconditional edges retain the exact original execution order.
import {readFileSync, writeFileSync} from 'node:fs';
import {decodeBytecode} from '../../../dist/decode/Decoder.js';
import {writeBytecode} from '../../../dist/decode/BytecodeWriter.js';
import {encodeAd, Opcode} from '../../../dist/decode/Opcode.js';

for (const opt of [0, 1, 2]) for (const debug of [1, 2]) {
  const stem = `open-pack-linear-chain-O${opt}g${debug}`;
  const module = decodeBytecode(readFileSync(new URL(`${stem}.luauc`, import.meta.url))).module;
  const convert = id => {
    const proto = module.prototypes[id];
    let instructions = [...proto.code], locals = proto.locals;
    if (proto.debugName === 'carry') {
      const producer = proto.instructions.find(insn => insn.opcode === Opcode.CALL && insn.c === 0);
      if (!producer) throw new Error('Missing authored open producer');
      const prefix = instructions.slice(0, producer.pc + producer.width);
      const suffix = instructions.slice(producer.pc + producer.width);
      if (suffix.length !== 2 || proto.instructions.at(-1).opcode !== Opcode.RETURN) {
        throw new Error('Unexpected authored carry body');
      }
      instructions = [encodeAd(Opcode.JUMP, 0, suffix.length), ...suffix, ...prefix,
        encodeAd(Opcode.JUMP, 0, -(suffix.length + prefix.length + 1))];
      // Both source parameters live for the complete function. Retain these
      // valid ranges in every variant so layout normalization does not hide
      // the reconstruction boundary that the fixture is intended to exercise.
      locals = [{name: 'outer', register: 0, startPc: 0, endPc: instructions.length},
        {name: 'inner', register: 1, startPc: 0, endPc: instructions.length}];
    }
    return {...proto, instructions, locals, children: proto.childProtoIds.map(convert)};
  };
  writeFileSync(new URL(`${stem}-shuffled.luauc`, import.meta.url), writeBytecode(convert(module.mainProtoId), {
    version: module.version, typesVersion: module.typesVersion,
  }));
}
