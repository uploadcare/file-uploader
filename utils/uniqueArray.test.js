import { expect } from '@esm-bundle/chai';
import { uniqueArray } from './uniqueArray';

describe('uniqueArray', () => {
  it('should return deduplicated array', () => {
    expect(uniqueArray([1, 2, 3])).to.eql([1, 2, 3]);
  });
});
