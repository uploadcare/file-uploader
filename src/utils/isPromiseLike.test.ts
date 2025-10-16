import { describe, expect, it } from 'vitest';
import { isPromiseLike } from './isPromiseLike';

describe('isPromiseLike', () => {
  it('should return true for Promise instances', () => {
    expect(isPromiseLike(Promise.resolve())).toBe(true);
  });

  it('should return true for thenable objects', () => {
    // biome-ignore lint/suspicious/noThenProperty: This is thenable object for testing purposes
    const thenable = { then: () => {} };
    expect(isPromiseLike(thenable)).toBe(true);
  });

  it('should return false for non-thenable objects', () => {
    expect(isPromiseLike({})).toBe(false);
    expect(isPromiseLike(null)).toBe(false);
    expect(isPromiseLike(42)).toBe(false);
    expect(isPromiseLike('string')).toBe(false);
  });
});
