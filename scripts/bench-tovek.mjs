#!/usr/bin/env node
// Pinned public inputs only; reuse the existing parser and trace comparators.
import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runBenchmark} from './bench-compare.mjs';
import {launch,classify} from './competition/evaluate.mjs';
import {decompile} from '../dist/decompile.js';

const directories=['docs/assets/v26/tovek/samples','luau-lifter/tests/fixtures'];
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const blob=bytes=>createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const safe=path=>typeof path==='string' && !path.startsWith('/') && path.split('/').every(p=>p && p!=='.' && p!=='..') && !path.includes('\\');
async function files(root,path){
 let entries;try{entries=await readdir(join(root,path),{withFileTypes:true});}catch(e){if(e.code==='ENOENT')return [];throw e;}
 const result=[];
 for(const entry of entries){const name=path+'/'+entry.name;if(entry.isDirectory())result.push(...await files(root,name));else result.push(name);}
 return result;
}
export async function verifyTovekCorpus(root,lock){
 if(lock.schemaVersion!==1 || lock.repository!=='Kiet1308/Tovek' || !/^[a-f0-9]{40}$/.test(lock.revision) || !Array.isArray(lock.files) || !Array.isArray(lock.inputs))throw Error('invalid Tovek lock');
 const contents=new Map();
 for(const entry of lock.files){
  if(!safe(entry.path))throw Error('invalid locked path');
  if(contents.has(entry.path))throw Error('duplicate locked path');
  const bytes=await readFile(join(root,entry.path));
  if(bytes.length!==entry.bytes || blob(bytes)!==entry.gitBlobSha1)throw Error('Tovek integrity mismatch: '+entry.path);
  contents.set(entry.path,bytes);
 }
 const actual=(await Promise.all(directories.map(path=>files(root,path)))).flat().filter(path=>path.endsWith('.luaubc') || path.endsWith('.client.txt')).sort();
 const expected=lock.inputs.map(entry=>entry.path).sort();
 if(new Set(expected).size!==expected.length || JSON.stringify(actual)!==JSON.stringify(expected))throw Error('Tovek input set mismatch');
 return lock.inputs.map(entry=>{
  if(!contents.has(entry.path) || !['raw','text'].includes(entry.form) || !['official','roblox'].includes(entry.encoding) || entry.reference && !contents.has(entry.reference))throw Error('invalid Tovek input');
  const original=contents.get(entry.path);
  let bytes=original;
  if(entry.form==='text'){
   const encoded=original.toString('utf8').split(/\r?\n/).filter(line=>!line.trim().startsWith('--')).join('').trim();
   if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded))throw Error('invalid Base64 sample');
   bytes=Buffer.from(encoded,'base64');
  }
  return {...entry,bytes,inputSha256:digest(original),bytecodeSha256:digest(bytes),bytecodeVersion:bytes[0]};
 });
}

async function main(){
 const args=process.argv.slice(2),options={};
 for(let i=0;i<args.length;i+=2){if(!['--corpus','--luau-compile','--luau','--output'].includes(args[i]) || !args[i+1])throw Error('invalid arguments');options[args[i]]=resolve(args[i+1]);}
 if(!options['--corpus'] || !options['--output'] || !options['--luau-compile'])throw Error('--corpus, --output and --luau-compile are required');
 const root=options['--corpus'],output=options['--output'];
 const lock=JSON.parse(await readFile(new URL('../benchmarks/tovek-lock.json',import.meta.url),'utf8'));
 const inputs=await verifyTovekCorpus(root,lock);
 await mkdir(join(output,'inputs'),{recursive:true});
 const encodings=new Map(),fixtures=[];
 for(const [i,input]of inputs.entries()){
  const path=join(output,'inputs',i+'.luauc');await writeFile(path,input.bytes);
  encodings.set(input.bytecodeSha256,input.encoding);
  fixtures.push({id:input.path,bytecode:path,provenance:`${lock.repository}@${lock.revision}`});
 }
 const manifest=join(output,'manifest.json');await writeFile(manifest,JSON.stringify({schemaVersion:1,fixtures}));
 const report=await runBenchmark({manifest,compiler:options['--luau-compile'],sourceDir:join(output,'source'),
  engine:bytes=>decompile(bytes,{opcodeEncoding:encodings.get(digest(bytes))})});
 report.corpus={repository:lock.repository,revision:lock.revision,lockSha256:digest(await readFile(new URL('../benchmarks/tovek-lock.json',import.meta.url)))};
 report.comparisonNote='Pinned public bytecode, locally evaluated. Published source observations are not direct execution of the legacy bytecode or a competitor engine comparison.';
 for(const [i,row]of report.samples.entries()){
  const input=inputs[i];row.input={path:input.path,inputSha256:input.inputSha256,bytecodeSha256:input.bytecodeSha256,bytecodeVersion:input.bytecodeVersion,encoding:input.encoding};
  row.status=!row.ourEngine.success?'UNSUPPORTED':row.ourEngine.syntax.status==='FAIL'?'INVALID':'NO MEDIDO';
  if(options['--luau'] && input.reference && input.path.startsWith('luau-lifter/')){
   const source=join(root,input.reference),target=join(output,'source',input.path.replace(/[^A-Za-z0-9_-]/g,'_')+'.luau');
   const optimization=input.sourceOptimization ?? 2;
   const originals=[launch(options['--luau'],[`-O${optimization}`,source],root)];
   const parser=row.ourEngine.success?launch(options['--luau-compile'],['--only-parse',target],root):undefined;
   const runs=parser?.ok?[launch(options['--luau'],[`-O${optimization}`,target],root)]:[];
   row.sourceObservation={basis:'published paired source with current VM; legacy bytecode not executed',optimization,
    originalSourceSha256:digest(await readFile(source)),...classify({parser,originals,runs}),parser,originals,runs};
  }
 }
 await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
 const lines=['# Tovek public corpus',`Revision: ${lock.revision}`,'','Paired-source observations are separate from bytecode equivalence; parser PASS is not semantic MATCH.','',
  '| Input | Version | Decode | Parser | Source observation |','|---|---:|---|---|---|',
  ...report.samples.map(row=>`| ${row.id} | ${row.input.bytecodeVersion} | ${row.ourEngine.success?'PASS':row.ourEngine.errorCode} | ${row.ourEngine.syntax?.status??'NOT_CHECKED'} | ${row.sourceObservation?.status??'NO MEDIDO'} |`)];
 await writeFile(join(output,'README.md'),lines.join('\n')+'\n');
 console.log(`Saved ${report.samples.length} public inputs to ${output}`);
 if(report.samples.some(row=>!row.ourEngine.success || row.ourEngine.syntax.status!=='PASS' || row.ourEngine.astValidationIssues || ['INVALID','MISMATCH'].includes(row.sourceObservation?.status)))process.exitCode=1;
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
