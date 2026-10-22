#!/usr/bin/env node
/** Only the fixed, project-authored originals may enter this execution runner. */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { decompile, defaultCleanupOptions } from '../dist/decompile.js';
import { reconstructFunction } from '../dist/reconstruct/Reconstructor.js';
import { chunk } from '../dist/ast/Ast.js';
import { printLuau } from '../dist/print/LuauPrinter.js';
import { ExternalClient, responseSource, digest } from './competition/external.mjs';
import { launch, classify, sourceMetrics, similarity } from './competition/evaluate.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const ENGINE_OPTIONS={opcodeEncoding:'official'};
const PIN='9d7748a4f324213a18cb8283fa2a77c330225fa0';
async function buildDigest() {
  const files=(await readdir(join(ROOT,'dist'),{recursive:true})).filter(f=>f.endsWith('.js')).sort();
  const entries=[];
  for(const file of files)entries.push([file,digest(await readFile(join(ROOT,'dist',file)))]);
  return digest(JSON.stringify(entries));
}
export function markdown(report) {
  const rows=['# Three-engine comparison against authored originals','',
    `Compiler revision (declared): ${report.compiler.revision}. Profiles: O0/O1, debug level 1.`,
    'Each of the 12 independent programs runs with three inputs. MATCH means identical observed traces, not universal equivalence.',
    'No ranking is assigned to unmeasured engines. Structural/token metrics are secondary lexical diagnostics, not semantic scores.','',
    '| Program | O | AnnonyA | LunaUX | Lua.Expert |','|---|---:|---|---|---|'];
  for(const r of report.results)rows.push(`| ${r.id} | ${r.optimization} | ${r.engines.annony.status} | ${r.engines.lunaux.status} | ${r.engines.luaexpert.status} |`);
  rows.push('','## Evidence','', '| Program/profile | Engine | Matching inputs | Normalized token similarity | Time (ms) |','|---|---|---:|---:|---:|');
  for(const r of report.results)for(const [name,e]of Object.entries(r.engines)){
    const matching=e.runs?.filter((run,i)=>run.ok&&run.stdout===r.originalRuns[i].stdout&&run.stderr===r.originalRuns[i].stderr).length;
    rows.push(`| ${r.id}/O${r.optimization} | ${name} | ${matching===undefined?'—':`${matching}/${r.inputs.length}`} | ${e.similarity?.toFixed(3)??'—'} | ${e.elapsedMs?.toFixed(1)??'—'} |`);
  }
  rows.push('','Times are single observations: HTTP elapsed time includes transport; local time measures decompilation. They are not a fair throughput benchmark.',
    'All sources, exact bytecode, hashes, request/response records, traces and lexical counts are in report.json and sibling artifacts.',
    'Binding/capture correctness and lost effects are exercised by input-specific traces; static scope equivalence is not established.','');
  for(const r of report.results)for(const [name,e]of Object.entries(r.engines))if(e.reason)rows.push(`- ${r.id}/O${r.optimization} ${name}: ${e.status} — ${String(e.reason).replace(/[\r\n|<>]/g,' ').slice(0,300)}`);
  return rows.join('\n')+'\n';
}
export async function runCompetition({compiler,interpreter,output,cache,external=false,maxRequests=48,compilerRevision=PIN}={}) {
  if(!compiler||!interpreter||!output)throw new Error('--luau-compile, --luau and --output are required');
  const manifest=JSON.parse(await readFile(join(ROOT,'benchmarks/originals/manifest.json'),'utf8'));
  if(manifest.length!==12 || new Set(manifest.map(c=>c.id)).size!==12)throw new Error('expected 12 independent originals');
  await mkdir(output,{recursive:true});
  const client=new ExternalClient({cache:cache??join(output,'api-cache'),enabled:external,maxRequests});
  const report={schemaVersion:1,measuredAt:new Date().toISOString(),
    compiler:{path:compiler,revision:compilerRevision,sha256:digest(await readFile(compiler))},
    interpreter:{path:interpreter,sha256:digest(await readFile(interpreter))},
    engine:{commit:spawnSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).stdout.trim(),
      dirty:!!spawnSync('git',['status','--porcelain'],{cwd:ROOT,encoding:'utf8'}).stdout.trim(),
      buildSha256:await buildDigest(),options:ENGINE_OPTIONS,cleanup:defaultCleanupOptions(ENGINE_OPTIONS)},
    externalRequests:0,results:[]};
  for(const entry of manifest){
    if(!/^[a-z-]+$/.test(entry.id)||!Array.isArray(entry.inputs)||entry.inputs.length<3)throw new Error('invalid owned fixture manifest');
    const source=await readFile(join(ROOT,'benchmarks/originals',entry.id+'.luau'));
    for(const optimization of [0,1]){
      const directory=join(output,entry.id,`O${optimization}`);await mkdir(directory,{recursive:true});
      const original=join(directory,'original.luau');await writeFile(original,source);
      const args=['--binary',`-O${optimization}`,'-g1',original];
      const start=performance.now();
      const compiled=spawnSync(compiler,args,{timeout:15000,maxBuffer:4*1024*1024});
      if(compiled.status!==0||compiled.error||!compiled.stdout?.length)throw new Error(`compile ${entry.id}: ${compiled.stderr?.toString()??compiled.error}`);
      const bytes=compiled.stdout;await writeFile(join(directory,'bytecode.luauc'),bytes);
      const item={id:entry.id,optimization,inputs:entry.inputs,sourceSha256:digest(source),bytecodeSha256:digest(bytes),
        bytecodeVersion:bytes[0],compilerArgs:args,compileMs:performance.now()-start,
        originalMetrics:sourceMetrics(source.toString('utf8')),
        originalRuns:entry.inputs.map(input=>launch(interpreter,[`-O${optimization}`,original,'-a',...input],directory)),engines:{}};
      if(item.originalRuns.some(r=>!r.ok||!r.stdout))throw new Error(`invalid original ${entry.id}: ${JSON.stringify(item.originalRuns)}`);
      for(const name of ['annony','lunaux','luaexpert']){
        let recovered=null,metadata={};
        if(name==='annony'){
          const begin=performance.now();const result=decompile(new Uint8Array(bytes),ENGINE_OPTIONS);
          metadata={elapsedMs:performance.now()-begin,diagnostics:result.diagnostics};
          if(result.ok){
            recovered=Buffer.from(result.source);await writeFile(join(directory,'annony.disasm.txt'),result.disassembly);
            const raw=printLuau(chunk(reconstructFunction(result.module,result.module.prototypes[result.module.mainProtoId]).body.statements));
            await writeFile(join(directory,'annony.raw.luau'),raw);
          }
          else metadata={...metadata,status:/version|opcode/.test(result.code)?'UNSUPPORTED':'NO MEDIDO',reason:`${result.code}: ${result.error}`};
        } else {
          const response=await client.get(name,bytes);
          await writeFile(join(directory,name+'.response.json'),JSON.stringify(response,null,2)+'\n');
          metadata={elapsedMs:response.elapsedMs,cached:response.cached,responseFile:name+'.response.json',requestSha256:response.requestSha256};
          const decoded=responseSource(response);
          if(decoded.source)recovered=decoded.source;else metadata={...metadata,...decoded};
        }
        if(recovered!==null){
          const path=join(directory,name+'.luau');await writeFile(path,recovered);
          const parser=launch(compiler,['--only-parse',path],directory,15000);
          const runs=parser.ok?entry.inputs.map(input=>launch(interpreter,[`-O${optimization}`,path,'-a',...input],directory)):[];
          metadata={...metadata,...classify({parser,originals:item.originalRuns,runs}),parser,runs,
            sourceSha256:digest(recovered),metrics:sourceMetrics(recovered.toString('utf8')),
            similarity:similarity(source.toString('utf8'),recovered.toString('utf8'))};
          if(name==='annony' && metadata.status!=='MATCH'){
            const rawPath=join(directory,'annony.raw.luau');
            const rawParser=launch(compiler,['--only-parse',rawPath],directory,15000);
            const rawRuns=rawParser.ok?entry.inputs.map(input=>launch(interpreter,[`-O${optimization}`,rawPath,'-a',...input],directory)):[];
            metadata.rawDiagnostic={...classify({parser:rawParser,originals:item.originalRuns,runs:rawRuns}),parser:rawParser,runs:rawRuns};
          }
        }
        item.engines[name]=metadata;
      }
      report.results.push(item);report.externalRequests=client.requests;
      await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
      await writeFile(join(output,'report.md'),markdown(report));
      console.log(`${entry.id}/O${optimization}: ${Object.entries(item.engines).map(([e,r])=>`${e}=${r.status}`).join(' ')}`);
    }
  }
  return report;
}
async function main(){
  const args=process.argv.slice(2),options={};let requireMatch=false;
  for(let i=0;i<args.length;i++){
    const flag=args[i];if(flag==='--external'){options.external=true;continue;}if(flag==='--require-local-match'){requireMatch=true;continue;}
    const key={'--luau-compile':'compiler','--luau':'interpreter','--output':'output','--cache':'cache','--max-requests':'maxRequests','--compiler-revision':'compilerRevision'}[flag];
    if(!key||!args[i+1])throw new Error('invalid argument '+flag);
    const value=args[++i];options[key]=key==='maxRequests'?Number(value):key==='compilerRevision'?value:resolve(value);
  }
  if(options.maxRequests!==undefined&&(!Number.isInteger(options.maxRequests)||options.maxRequests<0||options.maxRequests>48))throw new Error('request budget must be 0..48');
  const report=await runCompetition(options);
  if(requireMatch&&report.results.some(r=>r.engines.annony.status!=='MATCH'))process.exitCode=1;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error);process.exitCode=1;});
