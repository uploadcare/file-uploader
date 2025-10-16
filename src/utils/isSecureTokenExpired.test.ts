import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isSecureTokenExpired } from './isSecureTokenExpired';

const DATE_NOW = 60 * 1000;
const THRESHOLD = 10 * 1000;

describe('isSecureTokenExpired', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(DATE_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return true if the token is expired', () => {
    expect(isSecureTokenExpired({ secureExpire: '0', secureSignature: '' }, { threshold: THRESHOLD })).toBe(true);
    expect(isSecureTokenExpired({ secureExpire: '59', secureSignature: '' }, { threshold: THRESHOLD })).toBe(true);
  });

  it('should return true if the token will expire in the next 10 seconds', () => {
    expect(isSecureTokenExpired({ secureExpire: '60', secureSignature: '' }, { threshold: THRESHOLD })).toBe(true);
    expect(isSecureTokenExpired({ secureExpire: '61', secureSignature: '' }, { threshold: THRESHOLD })).toBe(true);
    expect(isSecureTokenExpired({ secureExpire: '70', secureSignature: '' }, { threshold: THRESHOLD })).toBe(true);
  });

  it("should return false if the token is not expired and won't expire in next 10 seconds", () => {
    expect(isSecureTokenExpired({ secureExpire: '71', secureSignature: '' }, { threshold: THRESHOLD })).toBe(false);
    expect(isSecureTokenExpired({ secureExpire: '80', secureSignature: '' }, { threshold: THRESHOLD })).toBe(false);
  });
});
