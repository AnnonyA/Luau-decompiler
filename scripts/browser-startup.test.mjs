import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {waitForBrowser} from './browser-startup.mjs';

async function child(t, source) {
  const profile = await mkdtemp(join(tmpdir(), 'browser-startup-test-'));
  const process = spawn(globalThis.process.execPath, ['--input-type=module','-e',source,profile], {stdio:['ignore','ignore','pipe']});
  t.after(async()=>{
    if(process.exitCode===null && process.signalCode===null){const done=once(process,'exit');process.kill();await done;}
    await rm(profile,{recursive:true,force:true});
  });
  return {process,profile};
}

test('reads readiness without a stderr announcement and tolerates a partial file',async t=>{
  const {process,profile}=await child(t,`import{writeFile}from'node:fs/promises';const p=process.argv[1]+'/DevToolsActivePort';await writeFile(p,'4567\\n');setTimeout(()=>writeFile(p,'4567\\n/devtools/browser/test-id\\n'),120);setInterval(()=>{},1000);`);
  assert.equal(await waitForBrowser(process,profile), 'ws://127.0.0.1:4567/devtools/browser/test-id');
});
test('reports an early exit and its diagnostic instead of waiting for timeout',async t=>{
  const {process,profile}=await child(t,`process.stderr.write('browser startup failed\\n');process.exitCode=23;`);
  await assert.rejects(waitForBrowser(process,profile), /exit=23[\s\S]*browser startup failed/);
});
test('times out a process that never becomes ready, retaining diagnostics',async t=>{
  const {process,profile}=await child(t,`process.stderr.write('waiting forever\\n');setInterval(()=>{},1000);`);
  await assert.rejects(waitForBrowser(process,profile,{timeoutMs:500}), /timed out[\s\S]*waiting forever/);
});
