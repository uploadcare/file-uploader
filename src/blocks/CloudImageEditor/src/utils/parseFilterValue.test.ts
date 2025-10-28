import { describe, expect, it } from 'vitest';
import { parseFilterValue } from './parseFilterValue';

describe('parseFilterValue', () => {
  it('parses filter name and value from valid strings', () => {
    expect(parseFilterValue('iothari 100')).toEqual({ filter: 'iothari', value: 100 });
    expect(parseFilterValue('sedis 0')).toEqual({ filter: 'sedis', value: 0 });
  });

  it('returns null for invalid formats', () => {
    expect(parseFilterValue('invalid ')).toBeNull();
    expect(parseFilterValue('invalid')).toBeNull();
    expect(parseFilterValue('no number')).toBeNull();
    expect(parseFilterValue('123 456')).toBeNull();
  });
});
