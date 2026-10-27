#!/usr/bin/env node
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {generateProgram,GENERATOR_VERSION} from './fuzz/generator.mjs';
import {observeSource} from './fuzz/observe.mjs';
import {reduceSource,failureSignature} from './fuzz/reducer.mjs';
import {digest} from './competition/external.mjs';
import {buildDigest} from './bench-competition.mjs';
const options={count:8,seed:1,attempts:20};
for(let i=2;i<process.argv.length;i+=2){
 const key={'--luau':'interpreter','--luau-compile':'compiler','--output':'output','--count':'count','--seed':'seed','--reduce-attempts':'attempts'}[process.argv[i]];
 if(!key||!process.argv[i+1])throw Error('invalid argument '+process.argv[i]);
 options[key]=['count','seed','attempts'].includes(key)?Number(process.argv[i+1]):resolve(process.argv[i+1]);
}
if(!options.compiler||!options.interpreter||!options.output||!Number.isInteger(options.count)||options.count<1||options.count>100||!Number.isInteger(options.seed)||options.seed<0||options.seed+options.count>0x100000000||!Number.isInteger(options.attempts)||options.attempts<2||options.attempts>100)throw Error('compiler/runtime/output required; count 1..100, uint32 seeds, reduction attempts 2..100');
await mkdir(options.output,{recursive:true});
const report={generatorVersion:GENERATOR_VERSION,engineSha256:await buildDigest(),compilerSha256:digest(await readFile(options.compiler)),interpreterSha256:digest(await readFile(options.interpreter)),options,results:[]};
for(let seed=options.seed;seed<options.seed+options.count;seed++){
 const program=generateProgram(seed);
 for(const optimization of [0,1,2]){
  const directory=join(options.output,`seed-${seed}`,`O${optimization}`);
  const config={compiler:options.compiler,interpreter:options.interpreter,optimization,inputs:program.inputs};
  const observation=await observeSource({...config,source:program.source,directory});
  const record={seed,optimization,...observation};
  if(failureSignature(observation)){
   const reduction=await reduceSource({source:program.source,maxAttempts:options.attempts,observe:(source,attempt)=>observeSource({...config,source,directory:join(directory,'reduction',String(attempt))})});
   await writeFile(join(directory,'reduced.luau'),reduction.source);
   await writeFile(join(directory,'reduction.json'),JSON.stringify(reduction,null,2)+'\n');
   record.reduction={signature:reduction.signature,attempts:reduction.attempts,originalBytes:reduction.originalBytes,reducedBytes:reduction.reducedBytes};
  }
  report.results.push(record);
  await writeFile(join(options.output,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(`seed ${seed}/O${optimization}: ${observation.status}${record.reduction?` (${record.reduction.originalBytes} -> ${record.reduction.reducedBytes} bytes)`:''}`);
 }
}
if(report.results.some(r=>r.status!=='MATCH'))process.exitCode=1;
