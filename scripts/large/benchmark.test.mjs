import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {markdown} from '../bench-competition.mjs';
import {digest} from '../competition/external.mjs';
import {loadSealedCorpus,significantLines} from './corpus.mjs';

test('large reports describe measured profiles and input counts, not the old fixed corpus',()=>{
 const report={compiler:{revision:'test'},results:[{id:'system',optimization:2,inputs:[['0'],['1']],originalRuns:[],engines:{annony:{status:'NO MEDIDO'},lunaux:{status:'NO MEDIDO'},luaexpert:{status:'NO MEDIDO'}}}]};
 const text=markdown(report);
 assert.match(text,/O2/);assert.doesNotMatch(text,/12 independent|three inputs|Profiles: O0\/O1/);
});
test('significant lines exclude formatting, comments and control delimiters',()=>{
 assert.equal(significantLines('-- comment\nlocal x = 1\nif x then\n print(x)\nelse\n print(2)\nend\n\n'),4);
});
test('sealed manifests reject modified sources and keep holdout separate',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'large-corpus-'));
 try{
  const source='print(1)\n';await writeFile(join(dir,'owned.luau'),source);
  const entries=[{id:'owned',source:'owned.luau',partition:'holdout',sourceSha256:digest(source),inputs:[['1'],['2'],['3']]}];
  await writeFile(join(dir,'manifest.json'),JSON.stringify(entries));
  const corpus=await loadSealedCorpus(join(dir,'manifest.json'),'development');assert.equal(corpus.length,0);
  assert.equal((await loadSealedCorpus(join(dir,'manifest.json'),'holdout')).length,1);
  await writeFile(join(dir,'owned.luau'),'print(2)\n');
  await assert.rejects(loadSealedCorpus(join(dir,'manifest.json'),'holdout'),/hash/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('isolated decoding records bounded worker resources and unsupported inputs honestly',async()=>{
 const {isolatedLocal}=await import('./local-runner.mjs');
 const {readFile}=await import('node:fs/promises');
 const dir=await mkdtemp(join(tmpdir(),'large-worker-'));
 try{
  await writeFile(join(dir,'bytecode.luauc'),Buffer.from([255,1]));
  await assert.rejects(isolatedLocal(Buffer.from([255,2]),dir),/shared input/);
  const result=await isolatedLocal(Buffer.from([255,1]),dir);
  assert.equal(result.source,undefined);assert.equal(result.metadata.status,'UNSUPPORTED');
  assert.ok(result.metadata.peakRssKiB>0);
  const process=JSON.parse(await readFile(join(dir,'annony.process.json'),'utf8'));
  assert.equal(process.status,0);assert.equal(process.heapLimitMiB,512);assert.equal(process.timeoutMs,30000);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('comparative summaries count only measured matches and retain holdout provenance',async()=>{
 const {summarize,render}=await import('./report.mjs');
 const row={id:'sample',optimization:0,partition:'holdout',inputs:[['1']],bytecodeBytes:1,originalRuns:[{stdout:'a',stderr:''}],engines:{annony:{status:'MISMATCH',runs:[{ok:true,stdout:'b',stderr:''}]},lunaux:{status:'NO MEDIDO'},luaexpert:{status:'MATCH',runs:[{ok:true,stdout:'a',stderr:''}]}}};
 const s=summarize({results:[]},{results:[]},{results:[row],corpus:{freeze:{buildSha256:'frozen'}}});
 assert.equal(s.counts.annony.match,0);assert.equal(s.counts.lunaux.match,0);assert.equal(s.counts.luaexpert.match,1);
 assert.equal(s.profiles[0].before,'NO MEDIDO');assert.equal(s.freeze.buildSha256,'frozen');
 assert.match(render(s),/holdout/);
});
