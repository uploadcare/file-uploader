import { describe, expect, it } from 'vitest';
import { linspace } from './linspace';

describe('linspace', () => {
  it('creates inclusive integer steps between endpoints', () => {
    expect(linspace(0, 10, 3)).toEqual([0, 5, 10]);
  });

  it('handles descending ranges', () => {
    expect(linspace(5, -5, 3)).toEqual([5, 0, -5]);
  });

  it('rounds up fractional steps to integers', () => {
    expect(linspace(0, 1, 4)).toEqual([0, 1, 1, 1]);
  });

  it('returns an empty array when n is zero', () => {
    expect(linspace(0, 5, 0)).toEqual([]);
  });
});
