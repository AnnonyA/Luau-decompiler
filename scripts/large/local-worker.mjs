// Runs owned bytecode in a disposable process. The parent bounds wall time and
// V8 heap; no bytecode is executed by the JavaScript decompiler.
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {decompile} from '../../dist/decompile.js';
import {reconstructFunction} from '../../dist/reconstruct/Reconstructor.js';
import {chunk} from '../../dist/ast/Ast.js';
import {printLuau} from '../../dist/print/LuauPrinter.js';
const directory=process.argv[2];
const bytes=await readFile(join(directory,'bytecode.luauc'));
const begin=performance.now();
const result=decompile(bytes,{opcodeEncoding:'official'});
const elapsedMs=performance.now()-begin;
if(result.ok){
 await writeFile(join(directory,'annony.disasm.txt'),result.disassembly);
 await writeFile(join(directory,'annony.ast.json'),JSON.stringify(result.ast));
 const raw=printLuau(chunk(reconstructFunction(result.module,result.module.prototypes[result.module.mainProtoId]).body.statements));
 await writeFile(join(directory,'annony.raw.luau'),raw);
}
process.stdout.write(JSON.stringify({source:result.ok?result.source:undefined,metadata:{elapsedMs,
 peakRssKiB:process.resourceUsage().maxRSS,diagnostics:result.diagnostics,
 ...(result.ok?{prototypes:result.module.prototypes.length,instructions:result.module.prototypes.reduce((n,p)=>n+p.instructions.length,0)}:{}),
 ...(result.ok?{}:{status:/version|opcode/.test(result.code)?'UNSUPPORTED':'NO MEDIDO',reason:`${result.code}: ${result.error}`})}}));
