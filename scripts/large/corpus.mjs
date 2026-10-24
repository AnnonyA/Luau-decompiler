import {readFile} from 'node:fs/promises';
import {dirname,resolve,relative,isAbsolute} from 'node:path';
import {digest} from '../competition/external.mjs';

// Conservative physical-line metric, not an AST statement count. Generated
// corpus files contain no multiline comments or multiline string literals.
export function significantLines(source) {
  return source.split(/\r?\n/).filter(line=>{
    const s=line.trim();
    return s && !s.startsWith('--') && !/^(?:end[,;]?|else|[{}()[\],;]+)$/.test(s);
  }).length;
}
export async function loadSealedCorpus(path,partition) {
  if(!['development','holdout'].includes(partition))throw Error('choose development or holdout');
  const manifest=JSON.parse(await readFile(path,'utf8'));
  if(!Array.isArray(manifest)||new Set(manifest.map(e=>e.id)).size!==manifest.length)throw Error('invalid corpus identities');
  const selected=manifest.filter(e=>e.partition===partition);
  for(const entry of selected){
    if(!/^[a-z][a-z0-9-]*$/.test(entry.id)||!Array.isArray(entry.inputs)||entry.inputs.length<3)throw Error('invalid owned source');
    const sourcePath=resolve(dirname(path),entry.source);
    const rel=relative(dirname(path),sourcePath);
    if(rel.startsWith('..')||isAbsolute(rel))throw Error('source outside corpus');
    const source=await readFile(sourcePath);
    if(digest(source)!==entry.sourceSha256)throw Error(`source hash mismatch: ${entry.id}`);
    entry.sourcePath=sourcePath;
  }
  return selected;
}
