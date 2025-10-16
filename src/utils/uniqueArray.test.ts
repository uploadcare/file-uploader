import { describe, expect, it } from 'vitest';
import { uniqueArray } from './uniqueArray';

describe('uniqueArray', () => {
  it('should return deduplicated array', () => {
    expect(uniqueArray([1, 2, 3])).toEqual([1, 2, 3]);
  });
});
