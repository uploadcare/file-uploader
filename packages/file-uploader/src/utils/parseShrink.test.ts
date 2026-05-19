import { describe, expect, it } from 'vitest';
import { parseShrink } from './parseShrink';

describe('parseShrink', () => {
  it('should be false', () => {
    // @ts-expect-error
    expect(parseShrink()).toBe(false);
  });

  it('should be right', () => {
    expect(parseShrink('1000x1000 100%')).toEqual({
      quality: 1,
      size: 1000000,
    });
  });

  it('should be right without quality', () => {
    expect(parseShrink('1000x1000')).toEqual({
      quality: undefined,
      size: 1000000,
    });
  });

  it('should be warn, because size shrink more max size', () => {
    expect(parseShrink('268435456x268435456 100%')).toBe(false);
  });
});
