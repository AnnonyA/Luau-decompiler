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
let nameStyles=false;
for(let i=0;i<args.length;i++){
 if(args[i]==='--name-styles'){nameStyles=true;continue;}
 if(!['--luau','--luau-compile','--output'].includes(args[i])||!args[i+1])throw Error('invalid arguments');
 options[args[i]]=resolve(args[i+1]);
 i++;
}
const compiler=options['--luau-compile'],vm=options['--luau'],output=options['--output'];
if(!compiler||!vm||!output)throw Error('--luau-compile, --luau and --output are required');
const styles = nameStyles ? [
 ['default',{}], ['compact',{generatedNames:'compact'}],
 ...['camelCase','snake_case','PascalCase'].map(nameCasing=>[nameCasing,{nameCasing}]),
] : [['default',{}]];
const results=[], fixtures=[];
for(const family of ['large','object-optimized']) {
 const root=fileURLToPath(new URL(`../tests/fixtures/${family}/`,import.meta.url));
 let inputMatrix = {};
 try { inputMatrix = JSON.parse(await readFile(join(root,'inputs.json'),'utf8')); }
 catch(error) { if(error.code !== 'ENOENT') throw error; }
 const files = (await readdir(root)).filter(f=>f.endsWith('.luau')).sort();
 if(Object.keys(inputMatrix).some(file=>!files.includes(file))) throw Error('unknown input fixture');
 for(const file of files){
  const inputs = inputMatrix[file] ?? [[]];
  if(!Array.isArray(inputs)||!inputs.length||inputs.some(args=>!Array.isArray(args)||args.some(arg=>typeof arg!=='string')))throw Error('invalid input matrix');
  fixtures.push({file:family+'/'+file,original:join(root,file),inputs});
 }
}
for(const {file,original,inputs} of fixtures)for(const optimization of [0,1,2]){
 const source=await readFile(original),dir=join(output,file.slice(0,-5),`O${optimization}`);
 await mkdir(dir,{recursive:true});
 const compiled=spawnSync(compiler,['--binary',`-O${optimization}`,'-g1',original],{timeout:15000,maxBuffer:4*1024*1024});
 if(compiled.status!==0||compiled.error)throw Error(`compile failed: ${file}`);
 await writeFile(join(dir,'bytecode.luauc'),compiled.stdout);
 const originals=inputs.map(args=>launch(vm,[`-O${optimization}`,original,'-a',...args],dir));
 for(const [style,naming] of styles){
  const result=decompile(compiled.stdout,{opcodeEncoding:'official',...naming});
  const target=join(dir,style==='default'?'annony.luau':`annony-${style}.luau`);
  await writeFile(target,result.ok?result.source:'');
  const parser=result.ok?launch(compiler,['--only-parse',target],dir):undefined;
  const runs=parser?.ok?inputs.map(args=>launch(vm,[`-O${optimization}`,target,'-a',...args],dir)):[];
  const comparison=classify({parser,originals,runs});
  results.push({id:file,optimization,style,inputs,options:naming,sourceSha256:digest(source),bytecodeSha256:digest(compiled.stdout),...comparison,parser,originals,runs});
  console.log(`${file}/O${optimization}/${style}: ${comparison.status}`);
 }

}
await writeFile(join(output,'report.json'),JSON.stringify({results},null,2)+'\n');
if(!results.length||results.some(r=>r.status!=='MATCH'))process.exitCode=1;
