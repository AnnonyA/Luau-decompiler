import { spawnSync } from 'node:child_process';
export function launch(program,args,cwd,timeout=3000) {
  const start=performance.now();
  const r=spawnSync(program,args,{cwd,timeout,maxBuffer:1024*1024,env:{PATH:process.env.PATH??''}});
  return {ok:r.status===0&&!r.error&&!r.signal,status:r.status,signal:r.signal??null,
    stdout:r.stdout?.toString('base64')??'',stderr:r.stderr?.toString('base64')??'',
    encoding:'base64',error:r.error?.message??null,elapsedMs:performance.now()-start};
}
export function classify({parser,originals,runs}) {
  if (!originals?.length || originals.some(r=>!r.ok || !r.stdout)) return {status:'NO MEDIDO',reason:'original execution failed or has no trace'};
  if (!parser || parser.error || parser.signal) return {status:'NO MEDIDO',reason:'official parser could not complete'};
  if (!parser?.ok) return {status:'INVALID',reason:'official parser rejected reconstructed source'};
  if (runs?.length!==originals.length) return {status:'NO MEDIDO',reason:'incomplete input matrix'};
  const failures=runs.flatMap((r,i)=>!r.ok||r.stdout!==originals[i].stdout||r.stderr!==originals[i].stderr?[i]:[]);
  return failures.length?{status:'MISMATCH',reason:'execution error or different observable trace',failingInputs:failures}:{status:'MATCH'};
}
const keywords=new Set('and break continue do else elseif end false for function if in local nil not or repeat return then true until while'.split(' '));
// Lexical diagnostics only, never proof of AST/binding equivalence. Treat an
// interpolated string as an opaque token (expressions inside are not counted).
function tokens(source) {
  return (source.match(/--\[(=*)\[[\s\S]*?\]\1\]|--[^\n]*|\[(=*)\[[\s\S]*?\]\2\]|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|`(?:\\[\s\S]|[^`\\])*`|[A-Za-z_][A-Za-z_0-9]*|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\.\.\.|==|~=|<=|>=|\+=|-=|\.\.|\S/g)??[])
    .filter(t=>!t.startsWith('--'));
}
export function sourceMetrics(source) {
  const ts=tokens(source), structures={};
  for(const name of ['if','elseif','while','for','repeat','function','return','local','break','continue']) structures[name]=ts.filter(t=>t===name).length;
  return {structures,assignments:ts.filter(t=>['=','+=','-=','*=','/='].includes(t)).length,
    tokens:ts.length,lines:source.split('\n').filter(x=>x.trim()).length,
    generatedNames:ts.filter(t=>/^(?:var|v|r|arg|up|value)\d+$/.test(t)).length,
    caveat:'lexical proxies, not AST, lexical-scope verification, or a readability verdict; interpolation bodies opaque'};
}
export function similarity(left,right) {
  const normalized=s=>tokens(s).filter(t=>t!==';').map(t=>/^[A-Za-z_]\w*$/.test(t)&&!keywords.has(t)?'ID':t);
  const grams=s=>{const ts=normalized(s),m=new Map(); for(let i=0;i<Math.max(0,ts.length-2);i++){const key=ts.slice(i,i+3).join('\0');m.set(key,(m.get(key)??0)+1);}return m;};
  if(normalized(left).join('\0')===normalized(right).join('\0'))return 1;
  const a=grams(left),b=grams(right);let common=0,total=0;
  for(const [key,n]of a){common+=Math.min(n,b.get(key)??0);total+=n;}for(const n of b.values())total+=n;
  return total?2*common/total:0;
}
