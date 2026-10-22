#!/usr/bin/env node
// Small, independently authored reductions of the large-system failures.
// Compile every source at all three optimization levels and compare the VM
// traces. No external adapters or requests are used by this runner.
import {readdir,readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {decompile} from '../dist/decompile.js';
import {launch,classify} from './competition/evaluate.mjs';
import {digest} from './competition/external.mjs';
const args=process.argv.slice(2),options={};
for(let i=0;i<args.length;i+=2){
 if(!['--luau','--luau-compile','--output'].includes(args[i])||!args[i+1])throw Error('invalid arguments');
 options[args[i]]=resolve(args[i+1]);
}
const compiler=options['--luau-compile'],vm=options['--luau'],output=options['--output'];
if(!compiler||!vm||!output)throw Error('--luau-compile, --luau and --output are required');
const root=fileURLToPath(new URL('../tests/fixtures/large/',import.meta.url)),results=[];
for(const file of (await readdir(root)).filter(f=>f.endsWith('.luau')).sort())for(const optimization of [0,1,2]){
 const original=join(root,file),source=await readFile(original),dir=join(output,file.slice(0,-5),`O${optimization}`);
 await mkdir(dir,{recursive:true});
 const compiled=spawnSync(compiler,['--binary',`-O${optimization}`,'-g1',original],{timeout:15000,maxBuffer:4*1024*1024});
 if(compiled.status!==0||compiled.error)throw Error(`compile failed: ${file}`);
 await writeFile(join(dir,'bytecode.luauc'),compiled.stdout);
 const result=decompile(compiled.stdout,{opcodeEncoding:'official'}),target=join(dir,'annony.luau');
 await writeFile(target,result.ok?result.source:'');
 const originals=[launch(vm,[`-O${optimization}`,original],dir)];
 const parser=result.ok?launch(compiler,['--only-parse',target],dir):undefined;
 const runs=parser?.ok?[launch(vm,[`-O${optimization}`,target],dir)]:[];
 const comparison=classify({parser,originals,runs});
 results.push({id:file,optimization,sourceSha256:digest(source),bytecodeSha256:digest(compiled.stdout),...comparison,parser,originals,runs});
 console.log(`${file}/O${optimization}: ${comparison.status}`);
}
await writeFile(join(output,'report.json'),JSON.stringify({results},null,2)+'\n');
if(!results.length||results.some(r=>r.status!=='MATCH'))process.exitCode=1;
