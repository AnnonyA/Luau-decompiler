#!/usr/bin/env node
import {readFile, writeFile, mkdir, readdir} from 'node:fs/promises';
import {resolve, join, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {cpus, platform, arch} from 'node:os';
import {digest} from './competition/external.mjs';

export function summarize(samples) {
  if (!samples.length || samples.some(n=>!Number.isFinite(n)||n<0)) throw Error('invalid samples');
  const sorted=[...samples].sort((a,b)=>a-b);
  const median=sorted.length%2 ? sorted[(sorted.length-1)/2] : (sorted[sorted.length/2-1]+sorted[sorted.length/2])/2;
  return {medianMs:median,p95Ms:sorted[Math.ceil(sorted.length*0.95)-1],minMs:sorted[0],maxMs:sorted.at(-1)};
}

async function worker(engine, bytecode, count, warmup, recovery) {
  const {decompile}=await import(pathToFileURL(engine));
  const bytes=await readFile(bytecode),samples=[],retainedHeapBytes=[],hashes=new Set();
  const options={opcodeEncoding:'official',recoverInlinedFunctions:recovery};
  let result,peakRssKiB=0;
  for(let i=-warmup;i<count;i++) {
    result=undefined;
    globalThis.gc?.(); // outside the timed region; discard the preceding result
    const before=process.memoryUsage().heapUsed,start=performance.now();
    result=decompile(bytes,options);
    const elapsed=performance.now()-start;
    if(!result.ok || result.validation.length || result.diagnostics.some(d=>d.severity==='error'))
      throw Error('decompilation failed: '+JSON.stringify(result.ok?result.diagnostics:result));
    peakRssKiB=Math.max(peakRssKiB,process.resourceUsage().maxRSS);
    if(i>=0) {
      samples.push(elapsed);
      globalThis.gc?.();
      retainedHeapBytes.push(Math.max(0,process.memoryUsage().heapUsed-before));
      hashes.add(digest(result.source));
    }
  }
  if(hashes.size!==1)throw Error('nondeterministic output across samples');
  // Hash after the final memory sample: serialization is not engine work.
  const correctnessSha256=digest(JSON.stringify({source:result.source,ast:result.ast,disassembly:result.disassembly,
    diagnostics:result.diagnostics,validation:result.validation}));
  return {samples,...summarize(samples),peakRssKiB,retainedHeapBytes,sourceSha256:[...hashes][0],
    correctnessSha256,sourceBytes:Buffer.byteLength(result.source),options};
}

function launchWorker(engine, bytecode, count, warmup, recovery) {
  const p=spawnSync(process.execPath,['--expose-gc',fileURLToPath(import.meta.url),'--worker',engine,bytecode,
    String(count),String(warmup),String(recovery)],{encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024});
  if(p.status!==0||p.error)throw Error('performance worker failed: '+(p.error?.message??p.stderr));
  return JSON.parse(p.stdout);
}

async function engineDigest(entry) {
  const folder=dirname(entry),files=(await readdir(folder,{recursive:true})).filter(f=>f.endsWith('.js')).sort();
  const hashes=[];
  for(const file of files)hashes.push([file,digest(await readFile(join(folder,file)))]);
  return digest(JSON.stringify(hashes));
}

async function main(args) {
  const options={samples:5,warmup:1},root=fileURLToPath(new URL('../',import.meta.url));
  for(let i=0;i<args.length;i++) {
    const flag=args[i];
    if(!['--baseline','--candidate','--luau-compile','--output','--samples','--warmup'].includes(flag)||!args[i+1])throw Error('invalid option '+flag);
    const value=args[++i]; options[flag.slice(2)]=['--samples','--warmup'].includes(flag)?Number(value):resolve(value);
  }
  if(!options.baseline||!options['luau-compile']||!options.output)throw Error('--baseline, --luau-compile and --output are required');
  if(!Number.isInteger(options.samples)||options.samples<1||options.samples>25||
    !Number.isInteger(options.warmup)||options.warmup<0||options.warmup>5)throw Error('invalid sample counts');
  const candidate=options.candidate??join(root,'dist/decompile.js'),baseline=options.baseline;
  await mkdir(options.output,{recursive:true});
  const cases=[];
  for(const family of ['benchmarks/large','benchmarks/large/cohort2']) {
    const folder=join(root,family),manifest=JSON.parse(await readFile(join(folder,'manifest.json')));
    const hashes=JSON.parse(await readFile(join(folder,'bytecode-sha256.json')));
    for(const entry of manifest) {
      const original=join(folder,entry.source),source=await readFile(original);
      if(digest(source)!==entry.sourceSha256)throw Error('sealed source changed: '+entry.id);
      for(const optimization of [0,1,2]) {
        const id=`${family.endsWith('cohort2')?'cohort2':'pilot'}/${entry.id}/O${optimization}`;
        const file=join(options.output,'bytecode',id+'.luauc');
        await mkdir(dirname(file),{recursive:true});
        const compiled=spawnSync(options['luau-compile'],['--binary',`-O${optimization}`,'-g1',original],{timeout:15000,maxBuffer:8*1024*1024});
        if(compiled.status!==0||compiled.error)throw Error('compilation failed '+id);
        if(digest(compiled.stdout)!==hashes[entry.id][optimization])throw Error('sealed bytecode changed: '+id);
        await writeFile(file,compiled.stdout);
        cases.push({id,file,sourceSha256:entry.sourceSha256,bytecodeSha256:digest(compiled.stdout),bytecodeBytes:compiled.stdout.length});
      }
    }
  }
  const report={node:process.version,platform:platform(),arch:arch(),cpu:cpus()[0]?.model,
    compilerSha256:digest(await readFile(options['luau-compile'])),baseline,candidate,
    baselineBuildSha256:await engineDigest(baseline),candidateBuildSha256:await engineDigest(candidate),samples:options.samples,warmup:options.warmup,
    methodology:'Fresh process per profile/engine; alternating baseline/candidate order; GC outside timing. RSS is whole-worker peak including warmup. Retained heap holds the API result. Recovery disabled only for output-identical performance comparison; candidate default mode measured separately. No hard timing CI thresholds.',results:[]};
  for(let i=0;i<cases.length;i++) {
    const test=cases[i],results={};
    for(const [name,engine] of i%2 ? [['candidate',candidate],['baseline',baseline]] : [['baseline',baseline],['candidate',candidate]])
      results[name]=launchWorker(engine,test.file,options.samples,options.warmup,false);
    results.default=launchWorker(candidate,test.file,options.samples,options.warmup,true);
    const same=results.baseline.correctnessSha256===results.candidate.correctnessSha256;
    report.results.push({...test,...results,identicalOutput:same,speedup:results.baseline.medianMs/results.candidate.medianMs,
      rssChangePercent:100*(results.candidate.peakRssKiB/results.baseline.peakRssKiB-1)});
    await writeFile(join(options.output,'report.json'),JSON.stringify(report,null,2)+'\n');
    console.log(`${test.id}: ${same?'IDENTICAL':'DIFFERENT'}, ${report.results.at(-1).speedup.toFixed(2)}x`);
  }
  const sum=variant=>report.results.reduce((n,r)=>n+r[variant].medianMs,0);
  report.summary={profiles:report.results.length,identical:report.results.filter(r=>r.identicalOutput).length,
    baselineTotalMedianMs:sum('baseline'),candidateTotalMedianMs:sum('candidate'),defaultTotalMedianMs:sum('default'),
    speedup:sum('baseline')/sum('candidate'),defaultSpeedup:sum('baseline')/sum('default'),
    baselinePeakRssKiB:Math.max(...report.results.map(r=>r.baseline.peakRssKiB)),
    candidatePeakRssKiB:Math.max(...report.results.map(r=>r.candidate.peakRssKiB)),
    defaultPeakRssKiB:Math.max(...report.results.map(r=>r.default.peakRssKiB))};
  await writeFile(join(options.output,'report.json'),JSON.stringify(report,null,2)+'\n');
  const rows=['# Large-corpus performance','',report.methodology,'',
    '| Profile | Before ms | After ms | Default O2 recovery ms | Speedup | RSS before/after MiB |','|---|---:|---:|---:|---:|---:|',
    ...report.results.map(r=>`| ${r.id} | ${r.baseline.medianMs.toFixed(1)} | ${r.candidate.medianMs.toFixed(1)} | ${r.default.medianMs.toFixed(1)} | ${r.speedup.toFixed(2)}x | ${(r.baseline.peakRssKiB/1024).toFixed(1)} / ${(r.candidate.peakRssKiB/1024).toFixed(1)} |`),
    '',`Output-identical profiles: ${report.summary.identical}/${report.summary.profiles}.`,
    `Ratio of summed per-profile medians: ${report.summary.speedup.toFixed(2)}x; default mode: ${report.summary.defaultSpeedup.toFixed(2)}x.`,
    'These development corpora measure this host and Node version, not universal performance or competitor speed.'];
  await writeFile(join(options.output,'README.md'),rows.join('\n')+'\n');
  if(!cases.length||report.summary.identical!==cases.length)process.exitCode=1;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  if(process.argv[2]==='--worker')console.log(JSON.stringify(await worker(process.argv[3],process.argv[4],Number(process.argv[5]),Number(process.argv[6]),process.argv[7]==='true')));
  else await main(process.argv.slice(2));
}
