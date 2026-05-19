import { describe, expect, it } from 'vitest';
import { getTopLevelOrigin } from './get-top-level-origin';

describe('getTopLevelOrigin', () => {
  it('should return the top-level origin', () => {
    const origin = getTopLevelOrigin();
    expect(origin).toBe(window.location.origin);
  });
});
