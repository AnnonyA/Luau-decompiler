import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { ExternalClient, requestFor, responseSource } from './external.mjs';
import { classify, sourceMetrics, similarity } from './evaluate.mjs';

test('both request schemas preserve precisely the same bytes', () => {
  const bytes = Buffer.from([0, 128, 255, 10]);
  for (const engine of ['lunaux', 'luaexpert']) {
    const request = requestFor(engine, bytes);
    assert.deepEqual(Buffer.from(request.body.bytecode ?? request.body.script, 'base64'), bytes);
    assert.equal(request.body.source, undefined);
  }
});
test('transport/auth errors and undocumented responses are not semantic failures', () => {
  for (const status of [401, 403, 429, 500]) {
    assert.equal(responseSource({status, bodyBase64: Buffer.from('error').toString('base64')}).status, 'NO MEDIDO');
  }
  assert.equal(responseSource({status: 200, bodyBase64: Buffer.from('<html>gateway</html>').toString('base64')}).status, 'NO MEDIDO');
  assert.equal(responseSource({status: 400, bodyBase64: Buffer.from('Unsupported bytecode version 11').toString('base64')}).status, 'UNSUPPORTED');
});
test('HTTP cache avoids duplicate requests, retains exact bodies, and bounds traffic', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'decompiler-api-test-'));
  const bodies = [];
  const server = createServer(async (req, res) => {
    let body = ''; for await (const part of req) body += part;
    bodies.push(JSON.parse(body));
    res.writeHead(200, {'content-type':'text/plain'}); res.end('print("ok")\n');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const client = new ExternalClient({cache: directory, enabled:true, maxRequests:1, intervalMs:0,
      endpoints: {lunaux:`http://127.0.0.1:${server.address().port}/api/decompile`}});
    const bytes = Buffer.from([1, 2, 3]);
    const first = await client.get('lunaux', bytes);
    const cached = await client.get('lunaux', bytes);
    assert.equal(bodies.length, 1);
    assert.equal(first.bodyBase64, Buffer.from('print("ok")\n').toString('base64'));
    assert.equal(cached.cached, true);
    assert.equal(cached.requestSha256, first.requestSha256);
    assert.equal((await client.get('lunaux', Buffer.from([4]))).reason, 'request budget exhausted');
    const offline = new ExternalClient({cache:directory});
    assert.equal((await offline.get('lunaux', bytes, {} , `http://127.0.0.1:${server.address().port}/api/decompile`)).cached, true);
    assert.equal(JSON.parse(await readFile(first.cacheFile, 'utf8')).bodyBase64, first.bodyBase64);
  } finally { server.closeAllConnections(); await new Promise(resolve=>server.close(resolve)); await rm(directory,{recursive:true,force:true}); }
});
test('classification prioritizes syntax and observed behavior over source resemblance', () => {
  const trace = {ok:true,stdout:'3\n',stderr:''};
  assert.equal(classify({parser:{ok:false},originals:[trace],runs:[]}).status,'INVALID');
  assert.equal(classify({parser:{ok:true},originals:[trace],runs:[{...trace,stdout:'4\n'}]}).status,'MISMATCH');
  assert.equal(classify({parser:{ok:true},originals:[trace],runs:[{...trace,ok:false}]}).status,'MISMATCH');
  assert.equal(classify({parser:{ok:true},originals:[trace],runs:[trace]}).status,'MATCH');
  assert.equal(classify({parser:{ok:true},originals:[{...trace,ok:false}],runs:[trace]}).status,'NO MEDIDO');
  assert.equal(classify({parser:{ok:true},originals:[trace],runs:[]}).status,'NO MEDIDO');
});
test('lexical metrics ignore comments and strings and disclose their limits', () => {
  const metrics=sourceMetrics('-- function fake()\nlocal x="while for if"\nlocal function f(a) if a then return a end end');
  assert.equal(metrics.structures.function,1); assert.equal(metrics.structures.while,0); assert.equal(metrics.structures.if,1);
  assert.equal(similarity('local x=3; return x','local renamed=3; return renamed'),1);
  assert.ok(similarity('return 1','while true do print(3) end')<1);
});

test('rate limiting opens the circuit and is cached without retries', async () => {
  const directory=await mkdtemp(join(tmpdir(),'luau-rate-test-')); let calls=0;
  const server=createServer((req,res)=>{calls++;res.writeHead(429,{'retry-after':'60'});res.end('rate limited');});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const client=new ExternalClient({cache:directory,enabled:true,intervalMs:0,endpoints:{lunaux:`http://127.0.0.1:${server.address().port}`}});
    assert.equal((await client.get('lunaux',Buffer.from([1]))).status,429);
    assert.match((await client.get('lunaux',Buffer.from([2]))).reason,/circuit open/);
    assert.equal(calls,1);
    assert.equal((await client.get('lunaux',Buffer.from([1]))).cached,true);
  } finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(directory,{recursive:true,force:true});}
});

test('a hanging API request times out and cannot become a semantic verdict', async () => {
  const directory=await mkdtemp(join(tmpdir(),'luau-timeout-test-'));
  const server=createServer(()=>{});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const client=new ExternalClient({cache:directory,enabled:true,intervalMs:0,timeoutMs:100,endpoints:{lunaux:`http://127.0.0.1:${server.address().port}`}});
    const result=await client.get('lunaux',Buffer.from([1]));
    assert.equal(result.status,null);assert.equal(responseSource(result).status,'NO MEDIDO');
    assert.match((await client.get('lunaux',Buffer.from([2]))).reason,/circuit open/);
  } finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(directory,{recursive:true,force:true});}
});

test('12 originals are distinct from all 100 previous sources and each has multiple inputs',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../../benchmarks/originals/manifest.json',import.meta.url),'utf8'));
  const {readdir}=await import('node:fs/promises');
  const previousDir=new URL('../../benchmarks/semantic/',import.meta.url);
  const previous=await Promise.all((await readdir(previousDir)).filter(f=>f.endsWith('.luau')).map(f=>readFile(new URL(f,previousDir),'utf8')));
  assert.equal(manifest.length,12);const seen=new Set(previous);
  for(const entry of manifest){
    const source=await readFile(new URL(`../../benchmarks/originals/${entry.id}.luau`,import.meta.url),'utf8');
    assert.ok(!seen.has(source));seen.add(source);
    assert.ok(new Set(entry.inputs.map(JSON.stringify)).size>=3);
  }
});

test('parser infrastructure failure is not mislabeled as invalid source',()=>{
  const trace={ok:true,stdout:'trace',stderr:''};
  assert.equal(classify({parser:{ok:false,error:'ENOENT'},originals:[trace],runs:[]}).status,'NO MEDIDO');
  assert.equal(classify({parser:{ok:false,signal:'SIGTERM'},originals:[trace],runs:[]}).status,'NO MEDIDO');
});
