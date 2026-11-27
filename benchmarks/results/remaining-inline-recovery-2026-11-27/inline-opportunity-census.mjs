// Read-only target census. It deliberately never rewrites a call or asserts call-site safety.
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [dist, records, destination] = process.argv.slice(2);
if (!destination) throw new Error('Usage: node inline-opportunity-census.mjs engine/dist records/quick output.json');
const { decompile, parseQueryOptions } = await import(pathToFileURL(resolve(dist, 'decompile.js')));
const { analyzeBindings } = await import(pathToFileURL(resolve(dist, 'analysis/Bindings.js')));
const { inlineHelperLines } = await import(pathToFileURL(resolve(dist, 'reconstruct/InlineRecovery.js')));
const paths=[];
for (const section of await readdir(records)) for (const name of await readdir(join(records,section))) {
  for (const profile of ['O2g1','O2g2']) paths.push(join(records,section,name,profile+'.json'));
}
const unparen=e=>e?.kind==='paren'?unparen(e.expression):e;
const arithmetic=new Set(['+','-','*','/','//','%','^']);
const comparisons=new Set(['<','<=','>','>=','==','~=']);
const output=[];
let errors=0;
for (const path of paths.sort()) {
  const record=JSON.parse(await readFile(path,'utf8'));
  const result=decompile(new Uint8Array(await readFile(path.replace(/\.json$/,'.luauc'))),parseQueryOptions(new URLSearchParams()));
  if (!result.ok) { errors++;continue; }
  const evidence=inlineHelperLines(result.module);
  const {bindings}=analyzeBindings(result.ast.body);
  const owners=new Map(),declarations=new Map();
  for(const binding of bindings) {
    for(const ref of [...binding.reads,...binding.writes])owners.set(ref.node,binding);
    const group=declarations.get(binding.declaration)??[];group.push(binding);declarations.set(binding.declaration,group);
  }
  const primitive=(e,params,locals=new Map(),seen=new Set())=>{
    e=unparen(e); if(!e)return;
    if(e.kind==='literal')return new Set([e.value===null?'nil':typeof e.value]);
    if(e.kind==='identifier') {
      const owner=owners.get(e);
      if(!owner)return;
      if(params.has(owner))return new Set(['number']); // Retain the existing numeric-argument admission rule.
      if(locals.has(owner))return locals.get(owner);
      if(owner.writes.length || seen.has(owner))return;
      if(owner.declaration.kind==='numeric-for')return new Set(['number']);
      if(owner.declaration.kind!=='local')return;
      seen.add(owner);const answer=primitive(owner.declaration.values[owner.declarationIndex],params,locals,seen);seen.delete(owner);return answer;
    }
    if(e.kind==='unary') {
      const a=primitive(e.argument,params,locals,seen);if(!a)return;
      if(e.op==='not')return new Set(['boolean']);
      if(e.op==='-' && a.size===1 && a.has('number'))return a;
      return;
    }
    if(e.kind==='binary') {
      const a=primitive(e.left,params,locals,seen),b=primitive(e.right,params,locals,seen);if(!a||!b)return;
      if(a.size===1&&a.has('number')&&b.size===1&&b.has('number')) {
        if(arithmetic.has(e.op))return a;
        if(comparisons.has(e.op))return new Set(['boolean']);
      }
      if(a.size===1&&a.has('boolean')&&b.size===1&&b.has('boolean')&&['and','or','==','~='].includes(e.op))return a;
      return;
    }
    if(e.kind==='if-expr') {
      if(!primitive(e.test,params,locals,seen))return;
      const all=[e.consequent,...e.branches.map(b=>b.value),e.alternate].map(x=>primitive(x,params,locals,seen));
      if(all.some(x=>!x)||e.branches.some(b=>!primitive(b.test,params,locals,seen)))return;
      return new Set(all.flatMap(x=>[...x]));
    }
  };
  const functions=[];
  const visit=(node,parent)=>{
    if(!node||typeof node!=='object')return;
    if(node.kind==='function-decl'||node.kind==='function-expr')functions.push([node,parent]);
    for(const value of Object.values(node))if(Array.isArray(value))value.forEach(v=>visit(v,node));else if(value&&typeof value==='object')visit(value,node);
  };
  visit(result.ast,null);
  for(const [fn,parent] of functions) {
    if(fn.isVararg||fn.params.length>8)continue;
    const declared=declarations.get(fn)??[];
    const params=new Set(declared.filter(b=>b.scope===fn.body));
    if(params.size!==fn.params.length||[...params].some(b=>b.writes.length))continue;
    const kinds=new Set(),free=new Set();let nodes=0,maxReturnArity=0,minReturnArity=Infinity;
    let primitiveShape=true;
    const checkExpr=(e,locals)=>{
      if(!e)return false;
      const pending=[e];
      while(pending.length){const n=pending.pop();if(!n||typeof n!=='object')continue;if(n.kind){nodes++;if(nodes>512)return false;const owner=owners.get(n);if(owner&&!params.has(owner)&&owner.scope!==fn.body)free.add(owner.name);}for(const v of Object.values(n))if(Array.isArray(v))pending.push(...v);else if(v&&typeof v==='object')pending.push(v);}
      return primitive(e,params,locals);
    };
    const block=(body,inherited)=>{
      const locals=new Map(inherited);let terminal=false;
      for(const s of body.statements) {
        if(terminal)return false;
        if(s.kind==='local'&&s.names.length===1&&s.values.length===1){const owner=(declarations.get(s)??[])[0],kind=checkExpr(s.values[0],locals);if(!owner||owner.writes.length||!kind)return false;locals.set(owner,kind);}
        else if(s.kind==='return') {if(s.values.length<1||s.values.length>4)return false;for(const e of s.values){const kind=checkExpr(e,locals);if(!kind)return false;for(const k of kind)kinds.add(k);}minReturnArity=Math.min(minReturnArity,s.values.length);maxReturnArity=Math.max(maxReturnArity,s.values.length);terminal=true;}
        else if(s.kind==='if') {if(!checkExpr(s.test,locals)||s.branches.some(b=>!checkExpr(b.test,locals)))return false;const outcomes=[block(s.consequent,locals),...s.branches.map(b=>block(b.body,locals))];if(outcomes.some(x=>x===false))return false;const alternate=s.alternate?block(s.alternate,locals):'fallthrough';if(alternate===false)return false;terminal=alternate===true&&outcomes.every(x=>x===true);}
        else return false;
      }
      return terminal?true:'fallthrough';
    };
    primitiveShape=block(fn.body,new Map())===true&&minReturnArity===maxReturnArity;
    if(!primitiveShape)continue;
    const newKinds=[...kinds].filter(k=>k==='string'||k==='nil');
    if(!newKinds.length&&fn.params.length)continue;
    output.push({section:record.section,name:record.name,profile:record.profile,functionName:fn.name??(parent?.kind==='local'?parent.names.join(','):'<closure>'),line:fn.line??null,parameters:fn.params.length,arity:maxReturnArity,resultKinds:[...kinds].sort(),nodes,freeBindings:[...free].sort(),hasExistingLineEvidence:evidence.has(fn.line),newResultKinds:newKinds,zeroArguments:fn.params.length===0,category:newKinds.length?'primitive-return-types':'zero-argument-primitive',baselineRecord:path,scope:'Potential helper body only. Call-site matching, visibility, capture preservation, operand type proof, cost and ambiguity checks have not been discharged.'});
  }
}
const summary={engineDist:resolve(dist),records:resolve(records),profiles:paths.length,decompileErrors:errors,potentialHelpers:output.length,existingLineEvidence:output.filter(x=>x.hasExistingLineEvidence).length,bodyWithStringOrNil:output.filter(x=>x.newResultKinds.length).length,zeroArguments:output.filter(x=>x.zeroArguments).length,opportunities:output};
await writeFile(destination,JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({...summary,opportunities:undefined}));
