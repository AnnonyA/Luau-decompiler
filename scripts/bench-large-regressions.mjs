#!/usr/bin/env node
// Small, independently authored reductions of the large-system failures.
// Compile every source at all three optimization levels and compare the VM
// traces. No external adapters or requests are used by this runner.
import {readdir,readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {decompile} from '../dist/decompile.js';
import {launch,classify} from './competition/evaluate.mjs';
import {digest} from './competition/external.mjs';
const args=process.argv.slice(2),options={};
let nameStyles=false, rewriteOptions=false;
for(let i=0;i<args.length;i++){
 if(args[i]==='--name-styles'){nameStyles=true;continue;}
 if(args[i]==='--rewrite-options'){rewriteOptions=true;continue;}
 if(!['--luau','--luau-compile','--output'].includes(args[i])||!args[i+1])throw Error('invalid arguments');
 options[args[i]]=resolve(args[i+1]);
 i++;
}
const compiler=options['--luau-compile'],vm=options['--luau'],output=options['--output'];
if(!compiler||!vm||!output)throw Error('--luau-compile, --luau and --output are required');
// Default plus each individual inverse and both extremes cover option wiring
// and interactions without pretending to enumerate the 2^14 combinations.
const rewriteDefaults = {interpolatedStrings:true,mathConstants:false,ifExpressions:true,
 earlyContinue:true,earlyReturn:true,recoverInlinedFunctions:true,rerollUnrolledLoops:false,
 foldSingleUseTemps:true,unfoldModuleTables:true,keepDeadFunctions:true,preferConst:false,
 unicodeStrings:true,upvalueComments:false,functionLineComments:false};
const styles = rewriteOptions ? [
 ['default',{}],
 ...[true,false].map(enabled=>[enabled?'all-on':'all-off',Object.fromEntries(Object.keys(rewriteDefaults).map(key=>[key,enabled]))]),
 ...Object.entries(rewriteDefaults).map(([key,value])=>[key,{[key]:!value}]),
] : nameStyles ? [
 ['default',{}], ['compact',{generatedNames:'compact'}],
 ...['camelCase','snake_case','PascalCase'].map(nameCasing=>[nameCasing,{nameCasing}]),
] : [['default',{}]];
const results=[], fixtures=[];
// Supply Roblox stand-ins to the VM only. Compile, decompile and parse the
// unwrapped fixture so its bytecode still refers to the real Roblox globals.
async function runtimeFile(path, source, prelude, wrappedPath) {
 if (prelude === undefined) return path;
 await writeFile(wrappedPath, prelude + '\n' + source);
 return wrappedPath;
}
for(const family of ['large','object-optimized','rewrites']) {
 const root=fileURLToPath(new URL(`../tests/fixtures/${family}/`,import.meta.url));
 let inputMatrix = {};
 try { inputMatrix = JSON.parse(await readFile(join(root,'inputs.json'),'utf8')); }
 catch(error) { if(error.code !== 'ENOENT') throw error; }
 const files = (await readdir(root)).filter(f=>f.endsWith('.luau')).sort();
 if(Object.keys(inputMatrix).some(file=>!files.includes(file))) throw Error('unknown input fixture');
 for(const file of files){
  const inputs = inputMatrix[file] ?? [[]];
  if(!Array.isArray(inputs)||!inputs.length||inputs.some(args=>!Array.isArray(args)||args.some(arg=>typeof arg!=='string')))throw Error('invalid input matrix');
  let prelude;
  try { prelude = await readFile(join(root,'preludes',file),'utf8'); }
  catch(error) { if(error.code !== 'ENOENT') throw error; }
  fixtures.push({file:family+'/'+file,original:join(root,file),inputs,prelude});
 }
}
// These fixtures also exercise register reconstruction with stripped and full
// debug metadata. Keep the existing style matrix and artifact paths at g1.
const fullDebugProfiles = new Set(JSON.parse(await readFile(
 new URL('../tests/fixtures/full-debug-profiles.json',import.meta.url),'utf8')));
for (const file of fullDebugProfiles) {
 if (!fixtures.some(f => f.file === file)) throw Error('unknown debug-profile fixture: ' + file);
}
const profiles = fixtures.flatMap(fixture => (fullDebugProfiles.has(fixture.file) ? [1,0,2] : [1])
 .map(debugLevel => ({...fixture,debugLevel})));
for(const {file,original,inputs,prelude,debugLevel} of profiles)for(const optimization of [0,1,2]){
 const profile = debugLevel === 1 ? `O${optimization}` : `O${optimization}-g${debugLevel}`;
 const source=await readFile(original),dir=join(output,file.slice(0,-5),profile);
 await mkdir(dir,{recursive:true});
 const compiled=spawnSync(compiler,['--binary',`-O${optimization}`,`-g${debugLevel}`,original],{timeout:15000,maxBuffer:4*1024*1024});
 if(compiled.status!==0||compiled.error)throw Error(`compile failed: ${file}`);
 await writeFile(join(dir,'bytecode.luauc'),compiled.stdout);
 const originalRun = await runtimeFile(original,source,prelude,join(dir,'original-runtime.luau'));
 const originals=inputs.map(args=>launch(vm,[`-O${optimization}`,originalRun,'-a',...args],dir));
 for(const [style,naming] of debugLevel === 1 ? styles : [styles[0]]){
  const result=decompile(compiled.stdout,{opcodeEncoding:'official',...naming});
  const target=join(dir,style==='default'?'annony.luau':`annony-${style}.luau`);
  await writeFile(target,result.ok?result.source:'');
  const parser=result.ok?launch(compiler,['--only-parse',target],dir):undefined;
  const targetRun = await runtimeFile(target,result.ok?result.source:'',prelude,join(dir,`runtime-${style}.luau`));
  const runs=parser?.ok?inputs.map(args=>launch(vm,[`-O${optimization}`,targetRun,'-a',...args],dir)):[];
  const comparison=classify({parser,originals,runs});
  results.push({id:file,optimization,debugLevel,style,inputs,options:naming,sourceSha256:digest(source),bytecodeSha256:digest(compiled.stdout),...comparison,parser,originals,runs});
  console.log(`${file}/${profile}/${style}: ${comparison.status}`);
 }

}
await writeFile(join(output,'report.json'),JSON.stringify({results},null,2)+'\n');
if(!results.length||results.some(r=>r.status!=='MATCH'))process.exitCode=1;
