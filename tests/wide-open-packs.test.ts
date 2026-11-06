import {expect, it} from 'vitest';
import {abc, ad, compile, proto, Opcode} from './helpers.ts';
import {decodeBytecode} from '../src/decode/Decoder.ts';
import {reconstructFunction} from '../src/reconstruct/Reconstructor.ts';
import {printLuau} from '../src/print/LuauPrinter.ts';
import {chunk} from '../src/ast/Ast.ts';

it.each(['call', 'return', 'table'] as const)('retains 80 fixed values and an open vararg tail in %s', consumer => {
 const start = consumer === 'return' ? 0 : 1;
 const code: number[] = [];
 if (consumer === 'call') code.push(abc(Opcode.GETGLOBAL, 0), 0);
 if (consumer === 'table') code.push(abc(Opcode.NEWTABLE, 0), 0);
 for (let i = 0; i < 80; i++) code.push(ad(Opcode.LOADN, start + i, i));
 code.push(abc(Opcode.GETVARARGS, start + 80, 0));
 if (consumer === 'call') code.push(abc(Opcode.CALL, 0, 0, 1), abc(Opcode.RETURN, 0, 1));
 if (consumer === 'return') code.push(abc(Opcode.RETURN, 0, 0));
 if (consumer === 'table') code.push(abc(Opcode.SETLIST, 0, 1, 0), 1, abc(Opcode.RETURN, 0, 2));
 const {module} = decodeBytecode(compile(proto({maxStackSize: 82, isVararg: true,
  constants: [{kind: 'string', value: 'observe'}], instructions: code})));
 const ast = chunk(reconstructFunction(module, module.prototypes[module.mainProtoId]!).body.statements);
 const output = printLuau(ast);
 expect(output.replace(/\s+/g, ' ')).toContain(Array.from({length: 80}, (_, i) => i).join(', ') + ', ...');
});
