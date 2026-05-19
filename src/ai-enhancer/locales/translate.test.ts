import { describe, expect, it } from 'vitest';
import { enLocale } from './en';
import { translate } from './translate';

describe('translate', () => {
  it('returns the en locale value when no overrides are provided', () => {
    expect(translate('ai-enhancer-back')).toBe(enLocale['ai-enhancer-back']);
  });

  it('returns the override value when provided', () => {
    expect(translate('ai-enhancer-back', { 'ai-enhancer-back': 'Zurück' })).toBe('Zurück');
  });

  it('falls back to the en locale when the override does not have the key', () => {
    expect(translate('ai-enhancer-generate-btn', { 'ai-enhancer-back': 'Zurück' })).toBe(
      enLocale['ai-enhancer-generate-btn'],
    );
  });

  it('handles an undefined overrides argument', () => {
    expect(translate('ai-enhancer-busy', undefined)).toBe(enLocale['ai-enhancer-busy']);
  });
});
