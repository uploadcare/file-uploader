import { describe, expect, it } from 'vitest';
import { pick } from './pick';

describe('pick', () => {
  it('returns a subset of an object including inherited keys and explicit undefined values', () => {
    const prototype = { inherited: 'value' } as const;
    type Source = {
      own: number;
      withUndefined: undefined;
      optional?: string;
      inherited?: string;
    };

    const source = Object.create(prototype) as Source;
    source.own = 1;
    source.withUndefined = undefined;

    const result = pick(source, ['own', 'inherited', 'withUndefined', 'optional']);

    expect(result).toEqual({
      own: 1,
      inherited: 'value',
      withUndefined: undefined,
    });
    expect(Object.hasOwn(result, 'optional')).toBe(false);
  });

  it('omits keys when values are undefined and not present on the object', () => {
    const source: { defined?: string; other: number } = { other: 42 };
    const result = pick(source, ['defined', 'other']);

    expect(result).toEqual({ other: 42 });
    expect(Object.hasOwn(result, 'defined')).toBe(false);
  });
});
