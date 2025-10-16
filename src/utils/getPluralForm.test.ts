import { describe, expect, it } from 'vitest';
import { getPluralForm } from './getPluralForm';

describe('getPluralForm', () => {
  it('should return selected form for es-US', () => {
    expect(getPluralForm('en-US', 1)).toBe('one');
    expect(getPluralForm('en-US', 2)).toBe('other');
  });

  it('should return selected form for ru-RU', () => {
    expect(getPluralForm('ru-RU', 1)).toBe('one');
    expect(getPluralForm('ru-RU', 2)).toBe('few');
    expect(getPluralForm('ru-RU', 5)).toBe('many');
    expect(getPluralForm('ru-RU', 1.5)).toBe('other');
  });
});
