#!/usr/bin/env node
// Local-only VM checks: new independent regressions and additional inputs for
// the unchanged competition originals. No external client is imported.
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {decompile} from '../dist/decompile.js';
import {launch,classify} from './competition/evaluate.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const args=process.argv.slice(2),options={};
for(let i=0;i<args.length;i+=2){
  if(!['--luau','--luau-compile','--output'].includes(args[i])||!args[i+1])throw Error('invalid arguments');
  options[args[i]]=resolve(args[i+1]);
}
const compiler=options['--luau-compile'],vm=options['--luau'],output=options['--output'];
if(!compiler||!vm||!output)throw Error('--luau-compile, --luau and --output are required');
const hash=data=>createHash('sha256').update(data).digest('hex');
const results=[];
const inputs=[['-7'],['1'],['8']];
for(const folder of ['benchmarks/regressions/pr58','benchmarks/originals']){
  for(const name of (await readdir(join(root,folder))).filter(n=>n.endsWith('.luau')).sort()){
    const original=join(root,folder,name),source=await readFile(original);
    for(const optimization of [0,1]){
      const dir=join(output,folder.includes('regressions')?'regressions':'originals',name.slice(0,-5),`O${optimization}`);
      await mkdir(dir,{recursive:true});
      const compiled=spawnSync(compiler,['--binary',`-O${optimization}`,'-g1',original],{timeout:15000,maxBuffer:4*1024*1024});
      if(compiled.status!==0||compiled.error)throw Error(`compile failed: ${original}`);
      const bytes=compiled.stdout,result=decompile(bytes,{opcodeEncoding:'official'});
      await writeFile(join(dir,'bytecode.luauc'),bytes);
      await writeFile(join(dir,'original.luau'),source);
      const target=join(dir,'annony.luau');
      await writeFile(target,result.ok?result.source:'');
      const originals=inputs.map(input=>launch(vm,[`-O${optimization}`,original,'-a',...input],dir));
      const parser=result.ok?launch(compiler,['--only-parse',target],dir):undefined;
      const runs=parser?.ok?inputs.map(input=>launch(vm,[`-O${optimization}`,target,'-a',...input],dir)):[];
      const comparison=classify({parser,originals,runs});
      results.push({id:folder+'/'+name,optimization,inputs,sourceSha256:hash(source),bytecodeSha256:hash(bytes),...comparison,parser,originals,runs});
      console.log(`${name}/O${optimization}: ${comparison.status}`);
    }
  }
}
await writeFile(join(output,'report.json'),JSON.stringify({compilerSha256:hash(await readFile(compiler)),runtimeSha256:hash(await readFile(vm)),results},null,2)+'\n');
if(results.length!==36||results.some(r=>r.status!=='MATCH'))process.exitCode=1;
