import { describe, expect, it, vi } from 'vitest';
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

  it('notifies on change and dedupes unchanged writes', () => {
    const locale = new LocaleController();
    const listener = vi.fn();
    locale.subscribe(listener);

    locale.set('upload', 'Upload');
    expect(listener).toHaveBeenCalledTimes(1);

    locale.set('upload', 'Upload'); // unchanged
    expect(listener).toHaveBeenCalledTimes(1);

    locale.set('upload', 'Send');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('unsubscribe stops notifications', () => {
    const locale = new LocaleController();
    const listener = vi.fn();
    const off = locale.subscribe(listener);
    off();

    locale.set('upload', 'Upload');
    expect(listener).not.toHaveBeenCalled();
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

  it('destroy() clears values and listeners', () => {
    const locale = new LocaleController();
    locale.set('upload', 'Upload');
    const listener = vi.fn();
    locale.subscribe(listener);

    locale.destroy();

    expect(locale.has('upload')).toBe(false);
    locale.set('upload', 'Upload');
    expect(listener).not.toHaveBeenCalled();
  });

  it('values exposes the stored dictionary reflecting writes', () => {
    const locale = new LocaleController();
    expect(Object.keys(locale.values)).toEqual([]);

    locale.set('upload', 'Upload');
    expect(locale.values.upload).toBe('Upload');
  });
});
