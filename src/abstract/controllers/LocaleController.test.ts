import { describe, expect, it, vi } from 'vitest';
import { LocaleController } from './LocaleController';

describe('LocaleController ReactiveStore surface', () => {
  it('observe fires per-key on change and immediately with { immediate }', () => {
    const l = new LocaleController();
    l.set('upload', 'Upload');
    const seen: (string | undefined)[] = [];
    l.observe('upload', (v) => seen.push(v), { immediate: true });
    l.set('upload', 'Send');
    l.set('cancel', 'Cancel'); // unrelated key — must not fire
    expect(seen).toEqual(['Upload', 'Send']);
  });

  it('setMany applies several keys with one coalesced notify', () => {
    const l = new LocaleController();
    const listener = vi.fn();
    l.subscribe(listener);
    l.setMany({ upload: 'Upload', cancel: 'Cancel' });
    expect(l.get('upload')).toBe('Upload');
    expect(l.get('cancel')).toBe('Cancel');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
