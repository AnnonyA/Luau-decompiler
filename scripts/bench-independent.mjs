#!/usr/bin/env node
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {runCompetition,buildDigest} from './bench-competition.mjs';
import {digest} from './competition/external.mjs';
const root=fileURLToPath(new URL('../benchmarks/independent-2026-10-27/',import.meta.url));
const options={optimizations:[0,1,2],maxRequests:18};let seal=false;
for(let i=2;i<process.argv.length;i++){
 const flag=process.argv[i];if(flag==='--seal'){seal=true;continue;}if(flag==='--external'){options.external=true;continue;}
 const key={'--luau-compile':'compiler','--luau':'interpreter','--output':'output','--cache':'cache'}[flag];
 if(!key||!process.argv[i+1])throw Error('invalid argument '+flag);options[key]=resolve(process.argv[++i]);
}
if(!options.compiler||!options.interpreter)throw Error('official compiler and runtime required');
const manifestPath=join(root,'manifest.json');
if(seal){
 const entries=[];
 for(const name of (await readdir(join(root,'sources'))).filter(f=>f.endsWith('.luau')).sort()){
  const id=name.slice(0,-5),source=await readFile(join(root,'sources',name));
  const entry={id,sourceSha256:digest(source),partition:'independent-before-evaluation',inputs:[],bytecodeSha256:{}};
  for(const seed of [-13,-3,0,1,7,19])for(const mode of [0,1,2,3])entry.inputs.push([String(seed),String(mode)]);
  await mkdir(join(root,'bytecode',id),{recursive:true});
  for(const o of options.optimizations){
   const r=spawnSync(options.compiler,['--binary',`-O${o}`,'-g1',join(root,'sources',name)],{timeout:15000,maxBuffer:4*1024*1024});
   if(r.status!==0||r.error)throw Error('original compile failed '+id+': '+r.stderr);
   entry.bytecodeSha256[o]=digest(r.stdout);
   await writeFile(join(root,'bytecode',id,`O${o}.luauc`),r.stdout,{flag:'wx'});
  }
  entries.push(entry);
 }
 await writeFile(manifestPath,JSON.stringify({sealedAt:new Date().toISOString(),engineSha256:await buildDigest(),compilerSha256:digest(await readFile(options.compiler)),compilerRevision:'9d7748a4f324213a18cb8283fa2a77c330225fa0',provenance:'Authored independently of earlier corpus; engine frozen before first evaluation. Authors saw their own sources. No results used for engine tuning in this evaluation.',entries},null,2)+'\n',{flag:'wx'});
 console.log('Sealed '+entries.length+' original systems before evaluation.');
}else{
 if(!options.output)throw Error('--output required');
 const manifest=JSON.parse(await readFile(manifestPath));
 // Different hosts can produce different compiler binaries; reproduced bytecode
 // must still match every sealed hash before any engine is called.
 for(const e of manifest.entries)for(const o of options.optimizations){
  if(digest(await readFile(join(root,'bytecode',e.id,`O${o}.luauc`)))!==e.bytecodeSha256[o])throw Error('sealed bytecode differs');
 }
 const report=await runCompetition({...options,corpus:manifest.entries.map(e=>({...e,sourcePath:join(root,'sources',e.id+'.luau')}))});
 report.corpus={compilerBinaryMatchesSeal:report.compiler.sha256===manifest.compilerSha256,evaluationHistory:JSON.parse(await readFile(join(root,'evaluation-history.json'))),sealSha256:digest(await readFile(manifestPath)),engineAtSeal:manifest.engineSha256,engineUnchangedSinceSeal:report.engine.buildSha256===manifest.engineSha256,provenance:report.engine.buildSha256===manifest.engineSha256?manifest.provenance:'Post-evaluation regression run; see evaluationHistory for cases used in development.'};
 await writeFile(join(options.output,'report.json'),JSON.stringify(report,null,2)+'\n');
 if(report.results.length!==9||report.results.some(r=>r.engines.annony.status!=='MATCH'))process.exitCode=1;
}
