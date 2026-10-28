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
