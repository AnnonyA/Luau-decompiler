import {test} from 'node:test';
import assert from 'node:assert/strict';
import {summarize} from './bench-performance.mjs';
test('summarizes measured samples without dropping slower observations',()=>{
  assert.deepEqual(summarize([4,1,100,2]),{medianMs:3,p95Ms:100,minMs:1,maxMs:100});
  assert.equal(summarize([9,2,3]).medianMs,3);
});
test('rejects missing and invalid measurements',()=>{
  for(const values of [[],[NaN],[Infinity],[-1]])assert.throws(()=>summarize(values));
});
