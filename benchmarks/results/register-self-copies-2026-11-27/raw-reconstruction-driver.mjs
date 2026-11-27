import {readFileSync} from 'node:fs';
import {decodeBytecode} from '../../../dist/decode/Decoder.js';
import {reconstructFunction} from '../../../dist/reconstruct/Reconstructor.js';
import {chunk} from '../../../dist/ast/Ast.js';
import {printLuau} from '../../../dist/print/LuauPrinter.js';
const module = decodeBytecode(readFileSync(process.argv[2]), {opcodeEncoding: 'official'}).module;
const result = reconstructFunction(module, module.prototypes[module.mainProtoId]);
process.stdout.write(printLuau(chunk(result.body.statements)));
