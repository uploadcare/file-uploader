import { describe, expect, it, vi } from 'vitest';
import { memoize } from './memoize';

describe('memoize', () => {
  it('should cache result', () => {
    let counter = 0;
    const fn = vi.fn(() => counter++);
    const memoized = memoize(fn);
    memoized();
    memoized();
    memoized();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should cache result for each set of arguments', () => {
    const fn = vi.fn((a: number, b: number) => {
      return a + b;
    });
    const memoized = memoize(fn);

    memoized(1, 2);
    memoized(1, 2);
    memoized(1, 2);
    memoized(2, 3);
    memoized(2, 3);
    memoized(2, 3);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should return the same result as original function', () => {
    const fn = (a: number, b: number) => a + b;
    const memoized = memoize(fn);
    expect(memoized(1, 2)).toBe(fn(1, 2));
    expect(memoized(2, 3)).toBe(fn(2, 3));
    expect(memoized(3, 4)).toBe(fn(3, 4));
  });
});
