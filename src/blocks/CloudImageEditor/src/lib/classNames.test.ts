import { describe, expect, it } from 'vitest';
import { applyClassNames, classNames } from './classNames';

describe('classNames', () => {
  it('joins truthy tokens from strings and objects', () => {
    const result = classNames('foo', { bar: true, baz: false }, 'qux');
    expect(result).toBe('foo bar qux');
  });

  it('ignores falsy object values', () => {
    expect(classNames({ foo: true, bar: null, baz: undefined, qux: false })).toBe('foo');
  });
});

describe('applyClassNames', () => {
  it('toggles classes according to mappings', () => {
    const element = document.createElement('div');

    applyClassNames(element, 'foo', { bar: true, baz: false });

    expect(element.classList.contains('foo')).toBe(true);
    expect(element.classList.contains('bar')).toBe(true);
    expect(element.classList.contains('baz')).toBe(false);
  });

  it('removes classes when toggled to false', () => {
    const element = document.createElement('div');
    element.classList.add('foo', 'bar');

    applyClassNames(element, { foo: false, bar: true });

    expect(element.classList.contains('foo')).toBe(false);
    expect(element.classList.contains('bar')).toBe(true);
  });
});
