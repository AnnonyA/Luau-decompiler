#!/usr/bin/env node
// A freeze permits evaluation only after this exact build passed development.
// It does not turn a previously inspected holdout into a fresh blind sample.
import {readFile,writeFile} from 'node:fs/promises';
import {buildDigest} from '../bench-competition.mjs';
const [developmentPath,output]=process.argv.slice(2);
if(!developmentPath||!output)throw Error('usage: freeze-engine.mjs development/report.json freeze.json');
const report=JSON.parse(await readFile(developmentPath,'utf8'));
const buildSha256=await buildDigest();
if(report.engine.buildSha256!==buildSha256||report.results.length!==9||
 report.results.some(r=>r.partition!=='development'||r.engines.annony.status!=='MATCH'))throw Error('current build must pass all nine development profiles');
await writeFile(output,JSON.stringify({buildSha256,frozenAt:new Date().toISOString(),
 developmentReport:developmentPath,purpose:'Recorded engine before reserved-corpus evaluation'},null,2)+'\n',{flag:'wx'});
