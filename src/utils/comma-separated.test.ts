import { describe, expect, it } from 'vitest';
import { deserializeCsv, serializeCsv } from './comma-separated';

describe('deserializeCsv', () => {
  it('splits on commas', () => {
    expect(deserializeCsv('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('trims each item', () => {
    expect(deserializeCsv('   a   ,   b   ,  c   ')).toEqual(['a', 'b', 'c']);
  });

  it('drops empty items', () => {
    expect(deserializeCsv(',,,a, ,b,c,')).toEqual(['a', 'b', 'c']);
  });

  it('returns an empty list for an empty or whitespace-only string', () => {
    expect(deserializeCsv('')).toEqual([]);
    expect(deserializeCsv('  ')).toEqual([]);
  });
});

describe('serializeCsv', () => {
  it('joins with commas', () => {
    expect(serializeCsv(['a', 'b'])).toEqual('a,b');
  });
});
