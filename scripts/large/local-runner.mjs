import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
export async function isolatedLocal(bytes,directory) {
 if(!Buffer.from(bytes).equals(await readFile(join(directory,'bytecode.luauc'))))
  throw Error('local worker bytecode differs from the shared input');
 const start=performance.now();
 const result=spawnSync(process.execPath,['--max-old-space-size=512',fileURLToPath(new URL('./local-worker.mjs',import.meta.url)),directory],
   {timeout:30000,maxBuffer:8*1024*1024,encoding:'utf8'});
 await writeFile(join(directory,'annony.process.json'),JSON.stringify({status:result.status,signal:result.signal,
   error:result.error?.message,stderr:result.stderr,wallMs:performance.now()-start,heapLimitMiB:512,timeoutMs:30000},null,2)+'\n');
 if(result.status!==0||result.error)return {metadata:{status:'NO MEDIDO',reason:`local worker failed: ${result.error?.message??result.signal??result.status}`}};
 return JSON.parse(result.stdout);
}
