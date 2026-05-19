import { describe, expect, it } from 'vitest';
import { toKebabCase } from './toKebabCase';

describe('toKebabCase', () => {
  it('should convert camel string to kebab', () => {
    expect(toKebabCase('foo')).toBe('foo');
    expect(toKebabCase('foo1')).toBe('foo1');
    expect(toKebabCase('fooBar')).toBe('foo-bar');
    expect(toKebabCase('fooBar1')).toBe('foo-bar1');
  });
});
