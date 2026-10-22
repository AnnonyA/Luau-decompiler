#!/usr/bin/env node
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
export function summarize(before,development,holdout) {
 const prior=new Map(before.results.map(r=>[`${r.id}/O${r.optimization}`,r]));
 const profiles=[...development.results,...holdout.results].map(row=>({
  id:row.id,optimization:row.optimization,partition:row.partition,inputs:row.inputs.length,
  sourceSha256:row.sourceSha256,bytecodeSha256:row.bytecodeSha256,bytecodeBytes:row.bytecodeBytes,
  significantLines:row.significantLines,originalMetrics:row.originalMetrics,
  before:prior.get(`${row.id}/O${row.optimization}`)?.engines.annony.status??'NO MEDIDO',
  engines:Object.fromEntries(Object.entries(row.engines).map(([name,e])=>[name,{
   status:e.status,matchingInputs:e.runs?.filter((r,i)=>r.ok&&r.stdout===row.originalRuns[i].stdout&&r.stderr===row.originalRuns[i].stderr).length??0,
   parser:e.parser?.ok??false,elapsedMs:e.elapsedMs,peakRssKiB:e.peakRssKiB,
   similarity:e.similarity,metrics:e.metrics,sourceSha256:e.sourceSha256,reason:e.reason,
  }]))
 }));
 return {schemaVersion:1,engine:development.engine,holdoutEngine:holdout.engine,
  freeze:holdout.corpus?.freeze,profiles,
  counts:Object.fromEntries(['annony','lunaux','luaexpert'].map(name=>[name,{
   match:profiles.filter(p=>p.engines[name].status==='MATCH').length,total:profiles.length,
   matchingInputs:profiles.reduce((n,p)=>n+p.engines[name].matchingInputs,0),
  }]))};
}
export function render(summary) {
 const rows=['# Large original systems: five-program pilot','',
  'Each profile uses 12 deterministic inputs. MATCH means the official VM produced identical observable traces on those inputs, not universal equivalence.',
  'Development cases informed engine fixes; reserved cases were first evaluated after the recorded engine freeze. They must not be pooled as a blind generalization score.','',
  '| Program | Partition | O | AnnonyA before | AnnonyA after | LunaUX | Lua.Expert |',
  '|---|---|---:|---|---|---|---|'];
 for(const p of summary.profiles)rows.push(`| ${p.id} | ${p.partition} | ${p.optimization} | ${p.before} | ${p.engines.annony.status} | ${p.engines.lunaux.status} | ${p.engines.luaexpert.status} |`);
 rows.push('','| Engine | Matching profiles | Matching input runs |','|---|---:|---:|');
 for(const [name,count] of Object.entries(summary.counts))rows.push(`| ${name} | ${count.match}/${count.total} | ${count.matchingInputs}/${summary.profiles.reduce((n,p)=>n+p.inputs,0)} |`);
 rows.push('','| Program/O | Local decompile ms | Worker peak MiB | Bytecode KiB |','|---|---:|---:|---:|');
 for(const p of summary.profiles)rows.push(`| ${p.id}/O${p.optimization} | ${p.engines.annony.elapsedMs?.toFixed(1)??'—'} | ${p.engines.annony.peakRssKiB?(p.engines.annony.peakRssKiB/1024).toFixed(1):'—'} | ${(p.bytecodeBytes/1024).toFixed(1)} |`);
 rows.push('','Times are single measurements. Worker peak includes diagnostic AST/disassembly extraction. API latency includes network transport and cannot establish comparative engine speed.',
  'Structural counts and normalized-token similarities are in summary.json; they are lexical diagnostics and do not certify binding equivalence or readability. Full VM traces, bytecode, raw/final AST sources, disassembly and API bodies are preserved in evidence.tar.gz.','');
 return rows.join('\n');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [before,development,holdout,out]=process.argv.slice(2);
 if(!out)throw Error('usage: report.mjs before.json development.json holdout.json output-directory');
 const reports=await Promise.all([before,development,holdout].map(async path=>JSON.parse(await readFile(path,'utf8'))));
 const summary=summarize(...reports);await mkdir(out,{recursive:true});
 await writeFile(join(out,'summary.json'),JSON.stringify(summary,null,2)+'\n');
 await writeFile(join(out,'comparison.md'),render(summary));
}
