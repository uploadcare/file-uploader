import { isSecureTokenExpired } from './isSecureTokenExpired';
import { expect } from '@esm-bundle/chai';
import * as sinon from 'sinon';

const DATE_NOW = 60 * 1000;

describe('isSecureTokenExpired', () => {
  let clock;
  beforeEach(() => {
    clock = sinon.useFakeTimers(DATE_NOW);
  });

  afterEach(() => {
    clock.restore();
  });

  it('should return true if the token is expired', () => {
    expect(isSecureTokenExpired({ secureExpire: '0', secureSignature: '' })).to.equal(true);
    expect(isSecureTokenExpired({ secureExpire: '59', secureSignature: '' })).to.equal(true);
  });

  it('should return true if the token will expire in the next 10 seconds', () => {
    expect(isSecureTokenExpired({ secureExpire: '60', secureSignature: '' })).to.equal(true);
    expect(isSecureTokenExpired({ secureExpire: '61', secureSignature: '' })).to.equal(true);
    expect(isSecureTokenExpired({ secureExpire: '70', secureSignature: '' })).to.equal(true);
  });

  it("should return false if the token is not expired and won't expire in next 10 seconds", () => {
    expect(isSecureTokenExpired({ secureExpire: '71', secureSignature: '' })).to.equal(false);
    expect(isSecureTokenExpired({ secureExpire: '80', secureSignature: '' })).to.equal(false);
  });
});
