import {expect, it} from 'vitest';
import {NameAllocator} from '../src/reconstruct/Naming.ts';

it('allocates the first available suffix despite sparse reservations and numeric roots', () => {
  const names = new NameAllocator(['value', 'value3', 'value22']);
  expect([names.take('value'), names.take('value'), names.take('value2')])
    .toEqual(['value2', 'value4', 'value23']);
});

it('replays allocations after nested speculative rollbacks without skipping released suffixes', () => {
  const names = new NameAllocator(['value']);
  const outer = names.snapshot();
  expect(names.take('value')).toBe('value2');
  const inner = names.snapshot();
  expect(names.take('value')).toBe('value3');
  names.restore(inner);
  expect(names.take('value')).toBe('value3');
  names.restore(outer);
  expect(names.take('value')).toBe('value2');
  names.restore(inner);
  expect(names.take('value')).toBe('value3');
});

it('keeps deterministic names through a long collision sequence', () => {
  const names = new NameAllocator();
  expect(names.take('value')).toBe('value');
  for (let suffix = 2; suffix <= 4000; suffix++) expect(names.take('value')).toBe(`value${suffix}`);
});
it('keeps preferred function names available until their owner claims them',()=>{
  const names=new NameAllocator([],new Set(['result','result2']));
  expect(names.reserve('result')).toBe('result3');
  expect(names.claim('result')).toBe('result');
  expect(names.claim('result2')).toBe('result2');
});
it('retains preferred-name protection across speculative rollback',()=>{
  const names=new NameAllocator([],new Set(['result']));
  const snapshot=names.snapshot();
  expect(names.claim('result')).toBe('result');
  names.restore(snapshot);
  expect(names.reserve('result')).toBe('result2');
  expect(names.claim('result')).toBe('result');
});
