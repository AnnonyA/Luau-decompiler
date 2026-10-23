#!/usr/bin/env node
// Seal once, before decompiling or requesting external results. Executes only
// the authored originals and preserves the exact bytes for every profile.
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {loadSealedCorpus} from './corpus.mjs';
import {digest} from '../competition/external.mjs';
import {launch} from '../competition/evaluate.mjs';
const [manifestArg,compiler,vm]=process.argv.slice(2);
if(!manifestArg||!compiler||!vm)throw Error('usage: seal-bytecode.mjs manifest.json luau-compile luau');
const manifest=resolve(manifestArg),root=dirname(manifest),hashPath=join(root,'bytecode-sha256.json');
try{await access(hashPath);throw Error('bytecode already sealed');}catch(e){if(e.code!=='ENOENT')throw e;}
const entries=[...await loadSealedCorpus(manifest,'development'),...await loadSealedCorpus(manifest,'holdout')];
const hashes={},validation=[];
for(const entry of entries)for(const optimization of [0,1,2]){
 const args=['--binary',`-O${optimization}`,'-g1',entry.sourcePath];
 const compiled=spawnSync(compiler,args,{timeout:15000,maxBuffer:4*1024*1024});
 if(compiled.status!==0||compiled.error)throw Error(`compile ${entry.id}: ${compiled.stderr}`);
 const runs=entry.inputs.map(input=>launch(vm,[`-O${optimization}`,entry.sourcePath,'-a',...input],root));
 if(runs.some(r=>!r.ok||!r.stdout))throw Error(`invalid original ${entry.id}/O${optimization}: ${JSON.stringify(runs)}`);
 const dir=join(root,'bytecode',entry.id);await mkdir(dir,{recursive:true});
 await writeFile(join(dir,`O${optimization}.luauc`),compiled.stdout,{flag:'wx'});
 (hashes[entry.id]??={})[optimization]=digest(compiled.stdout);
 validation.push({id:entry.id,optimization,compilerArgs:args,sourceSha256:entry.sourceSha256,bytecodeSha256:hashes[entry.id][optimization],runs});
}
await writeFile(join(root,'original-validation.json'),JSON.stringify({sealedAt:new Date().toISOString(),compilerSha256:digest(await readFile(compiler)),vmSha256:digest(await readFile(vm)),validation},null,2)+'\n',{flag:'wx'});
await writeFile(hashPath,JSON.stringify(hashes,null,2)+'\n',{flag:'wx'});
