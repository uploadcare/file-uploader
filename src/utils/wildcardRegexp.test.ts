import { describe, expect, it } from 'vitest';
import { wildcardRegexp } from './wildcardRegexp';

describe('wildcardRegexp', () => {
  it('should return regexp to match wildcard', () => {
    const regexp = wildcardRegexp('*.jpg');
    expect(regexp).toBeInstanceOf(RegExp);
  });

  it('should work for mime types', () => {
    expect(wildcardRegexp('*.jpg').test('test.jpg')).toBe(true);
    expect(wildcardRegexp('image/*').test('image/jpeg')).toBe(true);
    expect(
      wildcardRegexp('application/vnd.openxmlformats-officedocument.*').test(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
      ),
    ).toBe(true);
  });
});
