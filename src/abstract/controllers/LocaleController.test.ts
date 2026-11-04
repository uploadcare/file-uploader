import { computed } from '@lit-labs/signals';
import { describe, expect, it } from 'vitest';
import { LocaleController } from './LocaleController';

describe('LocaleController', () => {
  it('starts empty and stores values', () => {
    const locale = new LocaleController();
    expect(locale.has('upload')).toBe(false);
    expect(locale.get('upload')).toBeUndefined();

    locale.set('upload', 'Upload');
    expect(locale.has('upload')).toBe(true);
    expect(locale.get('upload')).toBe('Upload');
  });

  it('getTracked() reads the value and auto-tracks the key under a computed', () => {
    const locale = new LocaleController();
    locale.set('upload', 'Upload');

    // A computed that reads through getTracked depends on the per-key signal, so
    // it recomputes when the key changes — the trackable read the plain,
    // bag-reading get() deliberately does not provide.
    const tracked = computed(() => locale.getTracked('upload'));
    expect(tracked.get()).toBe('Upload');

    locale.set('upload', 'Send');
    expect(tracked.get()).toBe('Send');
  });

  it('getTracked() returns undefined for an absent key', () => {
    const locale = new LocaleController();
    expect(locale.getTracked('missing')).toBeUndefined();
  });

  it('has() uses own-property semantics, not the prototype chain', () => {
    const locale = new LocaleController();
    expect(locale.has('toString')).toBe(false);
    expect(locale.has('__proto__')).toBe(false);
  });

  it('does not pollute the prototype for a key named __proto__', () => {
    const locale = new LocaleController();
    locale.set('__proto__', 'evil');
    expect(({} as Record<string, unknown>).evil).toBeUndefined();
    expect(locale.get('__proto__')).toBe('evil');
  });

  it('destroy() clears values', () => {
    const locale = new LocaleController();
    locale.set('upload', 'Upload');

    locale.destroy();

    expect(locale.has('upload')).toBe(false);
  });
});
