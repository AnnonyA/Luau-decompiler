#!/usr/bin/env node
// Run once after validating authored originals, before any decompiler results
// are inspected. Subsequent checks must not regenerate this manifest.
import {readFile,readdir,writeFile,access} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {digest} from '../competition/external.mjs';
import {significantLines} from './corpus.mjs';
const args=process.argv.slice(2);
if(args.length&&!(args.length===2&&args[0]==='--root'))throw Error('usage: seal-corpus.mjs [--root directory]');
const directory=args.length?resolve(args[1]):fileURLToPath(new URL('../../benchmarks/large/',import.meta.url));
const path=join(directory,'manifest.json');
try{await access(path);throw Error('manifest already sealed; do not overwrite reference sources');}catch(e){if(e.code!=='ENOENT')throw e;}
const inputs=[[-7,0],[-3,1],[-1,2],[0,0],[1,1],[2,2],[3,3],[5,0],[8,1],[13,2],[21,3],[34,4]].map(input=>input.map(String));
const entries=[];
for(const partition of ['development','holdout'])for(const name of (await readdir(join(directory,partition))).filter(n=>n.endsWith('.luau')).sort()){
 const source=await readFile(join(directory,partition,name));
 const lines=significantLines(source.toString());
 if(lines<1000||lines>5000)throw Error(`${name}: ${lines} significant lines outside 1000..5000`);
 entries.push({id:name.slice(0,-5),source:partition+'/'+name,partition,sourceSha256:digest(source),significantLines:lines,inputs});
}
if(entries.length!==5)throw Error('pilot requires five programs');
await writeFile(path,JSON.stringify(entries,null,2)+'\n',{flag:'wx'});
console.log(entries.map(e=>`${e.id}: ${e.significantLines} lines (${e.partition})`).join('\n'));
