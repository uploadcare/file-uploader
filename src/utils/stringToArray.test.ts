import { describe, expect, it } from 'vitest';
import { stringToArray } from './stringToArray';

describe('stringToArray', () => {
  it('should convert string to array', () => {
    expect(stringToArray('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('should trim surrounding spaces', () => {
    expect(stringToArray('   a   ,   b   ,  c   ')).toEqual(['a', 'b', 'c']);
  });

  it('should trim empty values', () => {
    expect(stringToArray(',,,a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('should accept custom delimiter', () => {
    expect(stringToArray('a b c', ' ')).toEqual(['a', 'b', 'c']);
  });
});
