import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {verifyTovekCorpus} from './bench-tovek.mjs';
const blob=data=>createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex');
async function fixture(run){
 const root=await mkdtemp(join(tmpdir(),'tovek-corpus-'));
 const path='luau-lifter/tests/fixtures/example.luaubc',bytes=Buffer.from([14,3,0]);
 await mkdir(join(root,'luau-lifter/tests/fixtures'),{recursive:true});await writeFile(join(root,path),bytes);
 const lock={schemaVersion:1,repository:'Kiet1308/Tovek',revision:'a'.repeat(40),files:[{path,bytes:bytes.length,gitBlobSha1:blob(bytes)}],inputs:[{path,encoding:'official',form:'raw'}]};
 try{await run(root,lock,bytes);}finally{await rm(root,{recursive:true,force:true});}
}
test('verifies pinned bytes and returns the exact input without recompiling',()=>fixture(async(root,lock,bytes)=>{
 const rows=await verifyTovekCorpus(root,lock);assert.equal(rows.length,1);assert.deepEqual(rows[0].bytes,bytes);
}));
test('rejects tampering before any engine evaluation',()=>fixture(async(root,lock)=>{
 await writeFile(join(root,lock.inputs[0].path),Buffer.from([14,3,1]));
 await assert.rejects(verifyTovekCorpus(root,lock),/integrity/);
}));
test('rejects unlocked bytecode files and traversal paths',()=>fixture(async(root,lock)=>{
 await writeFile(join(root,'luau-lifter/tests/fixtures/extra.luaubc'),Buffer.from([14]));
 await assert.rejects(verifyTovekCorpus(root,lock),/input set/);
 lock.files[0].path='../outside';await assert.rejects(verifyTovekCorpus(root,lock),/path/);
}));
test('decodes the locked text transport without changing Roblox opcode bytes',()=>fixture(async(root,lock,bytes)=>{
 const path='docs/assets/v26/tovek/samples/example.client.txt';
 const text=Buffer.from('-- public bytecode\n'+bytes.toString('base64')+'\n');
 await mkdir(join(root,'docs/assets/v26/tovek/samples'),{recursive:true});await writeFile(join(root,path),text);
 lock.files.push({path,bytes:text.length,gitBlobSha1:blob(text)});lock.inputs.push({path,form:'text',encoding:'roblox'});
 const rows=await verifyTovekCorpus(root,lock);assert.deepEqual(rows[1].bytes,bytes);assert.equal(rows[1].encoding,'roblox');
}));
