import { expect } from '@esm-bundle/chai';
import { stringToArray } from './stringToArray.js';

describe('stringToArray', () => {
  it('should convert string to array', () => {
    expect(stringToArray('a,b,c')).to.eql(['a', 'b', 'c']);
  });

  it('should trim surrounding spaces', () => {
    expect(stringToArray('   a   ,   b   ,  c   ')).to.eql(['a', 'b', 'c']);
  });

  it('should trim empty values', () => {
    expect(stringToArray(',,,a,b,c')).to.eql(['a', 'b', 'c']);
  });

  it('should accept custom delimiter', () => {
    expect(stringToArray('a b c', ' ')).to.eql(['a', 'b', 'c']);
  });
});
