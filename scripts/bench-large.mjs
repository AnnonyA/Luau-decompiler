#!/usr/bin/env node
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runCompetition,buildDigest} from './bench-competition.mjs';
import {loadSealedCorpus} from './large/corpus.mjs';
import {isolatedLocal} from './large/local-runner.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const args=process.argv.slice(2),options={};let partition='development',freeze,requireMatch=false,manifest=join(root,'benchmarks/large/manifest.json');
for(let i=0;i<args.length;i++){
 const flag=args[i];
 if(flag==='--external'){options.external=true;continue;}
 if(flag==='--require-local-match'){requireMatch=true;continue;}
 if(!args[i+1])throw Error('missing value '+flag);
 const value=args[++i];
 if(flag==='--partition'){partition=value;continue;}
 if(flag==='--freeze'){freeze=resolve(value);continue;}
 if(flag==='--manifest'){manifest=resolve(value);continue;}
 if(flag==='--max-requests'){options.maxRequests=Number(value);continue;}
 const key={'--luau-compile':'compiler','--luau':'interpreter','--cache':'cache','--output':'output'}[flag];
 if(!key)throw Error('unknown option '+flag);
 options[key]=resolve(value);
}
options.maxRequests??=0;
if(!Number.isInteger(options.maxRequests)||options.maxRequests<0||options.maxRequests>30)throw Error('large pilot request budget must be 0..30');
// The first reserved cohort was observed and is now used for development.
const corpus=await loadSealedCorpus(manifest,partition==='observed'?'holdout':partition);
if(partition==='observed')for(const entry of corpus)entry.partition='development-regression';
if(!corpus.length)throw Error('no sealed programs in partition');
const referenceHashes=JSON.parse(await readFile(join(dirname(manifest),'bytecode-sha256.json'),'utf8'));
for(const entry of corpus){
 entry.bytecodeSha256=referenceHashes[entry.id];
 if(!entry.bytecodeSha256)throw Error('missing sealed bytecode hashes: '+entry.id);
}
let frozen;
if(partition==='holdout'&&!freeze)throw Error('holdout requires --freeze with pre-evaluation engine hash');
if(freeze){
 frozen=JSON.parse(await readFile(freeze,'utf8'));
 if(frozen.buildSha256!==await buildDigest())throw Error('engine changed after holdout freeze');
}
const report=await runCompetition({...options,corpus,optimizations:[0,1,2],localRunner:isolatedLocal});
report.corpus={partition,freeze:frozen??null,manifest,evaluation:partition==='observed'?'development-regression':freeze?'frozen-evaluation':'development'};
await writeFile(join(options.output,'report.json'),JSON.stringify(report,null,2)+'\n');
if(requireMatch&&report.results.some(r=>r.engines.annony.status!=='MATCH'))process.exitCode=1;
