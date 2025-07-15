import { isPromiseLike } from './isPromiseLike';
import { expect } from '@esm-bundle/chai';

describe('isPromiseLike', () => {
  it('should return true for Promise instances', () => {
    expect(isPromiseLike(Promise.resolve())).to.be.true;
  });

  it('should return true for thenable objects', () => {
    const thenable = { then: () => {} };
    expect(isPromiseLike(thenable)).to.be.true;
  });

  it('should return false for non-thenable objects', () => {
    expect(isPromiseLike({})).to.be.false;
    expect(isPromiseLike(null)).to.be.false;
    expect(isPromiseLike(42)).to.be.false;
    expect(isPromiseLike('string')).to.be.false;
  });
});
