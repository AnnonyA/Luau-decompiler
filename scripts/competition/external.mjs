import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile, mkdtemp, rm, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const exec = promisify(execFile);
export const digest = data => createHash('sha256').update(data).digest('hex');
export const ENDPOINTS = Object.freeze({lunaux:'https://lunaux-decompiler.dev/api/decompile',luaexpert:'https://api.lua.expert/v1/decompile'});
export function requestFor(engine, bytes, options = {}, endpoint = ENDPOINTS[engine]) {
  if (!['lunaux','luaexpert'].includes(engine)) throw new Error('unknown engine');
  const encoded=Buffer.from(bytes).toString('base64');
  return {endpoint, body: engine === 'lunaux' ? {bytecode:encoded,options} : {script:encoded}};
}
export function responseSource(response) {
  const body = Buffer.from(response.bodyBase64 ?? '', 'base64');
  const text = body.toString('utf8');
  if ([400, 422].includes(response.status) && /unsupported (?:bytecode|opcode|version)|bytecode version .{0,30}not supported/i.test(text))
    return {status:'UNSUPPORTED',reason:text.slice(0,500)};
  if (response.status !== 200) return {status:'NO MEDIDO',reason:response.reason ?? `HTTP ${response.status}`};
  if (!body.length || /^\s*(?:<!doctype|<html|\{\s*"(?:error|message)")/i.test(text))
    return {status:'NO MEDIDO',reason:'unexpected API response, expected plain Luau source'};
  return {source:body};
}
export class ExternalClient {
  constructor({cache,enabled=false,maxRequests=48,intervalMs=1250,timeoutMs=20000,endpoints=ENDPOINTS}={}) {
    Object.assign(this,{cache,enabled,maxRequests,intervalMs,timeoutMs,endpoints});
    this.requests=0; this.lastRequest=0; this.blocked=new Map();
  }
  async get(engine,bytes,options={},overrideEndpoint) {
    const request=requestFor(engine,bytes,options,overrideEndpoint ?? this.endpoints[engine]);
    const requestSha256=digest(JSON.stringify(request));
    const cacheFile=join(this.cache,requestSha256+'.json');
    try {
      const saved=JSON.parse(await readFile(cacheFile,'utf8'));
      if (saved.requestSha256 !== requestSha256 || saved.bodySha256 !== digest(Buffer.from(saved.bodyBase64 ?? '', 'base64')))
        throw new Error('cache integrity check failed');
      return {...saved,cached:true,cacheFile};
    } catch(error) { if(error.code!=='ENOENT') throw error; }
    const unmeasured=reason=>({status:null,reason,requestSha256,request,bytecodeSha256:digest(bytes),cached:false});
    if (!this.enabled) return unmeasured('external requests disabled; no cached response');
    if (this.blocked.has(engine)) return unmeasured(this.blocked.get(engine));
    if (this.requests >= this.maxRequests) return unmeasured('request budget exhausted');
    const delay=this.intervalMs-(Date.now()-this.lastRequest);
    if(delay>0) await new Promise(resolve=>setTimeout(resolve,delay));
    this.requests++; this.lastRequest=Date.now();
    const temp=await mkdtemp(join(tmpdir(),'luau-api-'));
    const start=performance.now();
    let status=null,reason=null,body=Buffer.alloc(0),headers='';
    try {
      await writeFile(join(temp,'request.json'),JSON.stringify(request.body));
      const result=await exec('curl',['--silent','--show-error','--max-time',String(this.timeoutMs/1000),
        '--max-filesize','2097152','--request','POST','--header','Content-Type: application/json',
        '--data-binary','@'+join(temp,'request.json'),'--dump-header',join(temp,'headers'),
        '--output',join(temp,'body'),'--write-out','%{http_code}',request.endpoint],
        {timeout:this.timeoutMs+2000,maxBuffer:65536});
      status=Number(result.stdout);
    } catch(error) { reason=error.message; }
    try { body=await readFile(join(temp,'body')); } catch {}
    try { headers=await readFile(join(temp,'headers'),'utf8'); } catch {}
    await rm(temp,{recursive:true,force:true});
    const record={engine,request,requestSha256,bytecodeSha256:digest(bytes),status,reason,
      measuredAt:new Date().toISOString(),elapsedMs:performance.now()-start,
      headers:headers.split(/\r?\n/).filter(line=>/^(HTTP\/|content-type:|retry-after:|server:|x-.*version:)/i.test(line)),
      bodyBase64:body.toString('base64'),bodySha256:digest(body)};
    await mkdir(this.cache,{recursive:true});
    await writeFile(cacheFile+'.tmp',JSON.stringify(record,null,2)+'\n');
    await rename(cacheFile+'.tmp',cacheFile);
    if (status===null || [401,403,429].includes(status) || status>=500)
      this.blocked.set(engine,`circuit open after ${reason ?? `HTTP ${status}`}; no automatic retries`);
    return {...record,cached:false,cacheFile};
  }
}
