import { afterEach, describe, expect, it, vi } from 'vitest';
import { TypedData } from './TypedData';

describe('TypedData (ReactiveStore)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const make = () => new TypedData<{ a: number; b: string }>({ a: 0, b: '' });

  it('creates a unique uid and is discoverable via the registry', () => {
    const ctx1 = new TypedData<{ a: number }>({ a: 1 });
    const ctx2 = new TypedData<{ a: number }>({ a: 2 });

    expect(ctx1.uid).toBeTruthy();
    expect(ctx2.uid).toBeTruthy();
    expect(ctx1.uid).not.toBe(ctx2.uid);

    expect(TypedData.getByUid(ctx1.uid)).toBe(ctx1);
    expect(TypedData.getByUid(ctx2.uid)).toBe(ctx2);
    expect(TypedData.getByUid('nope')).toBeNull();

    ctx1.destroy();
    ctx2.destroy();
  });

  it('get/set round-trip', () => {
    const d = make();
    expect(d.get('a')).toBe(0);
    d.set('a', 1);
    expect(d.get('a')).toBe(1);
    d.destroy();
  });

  it('warns when reading an unknown property and returns undefined', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ctx = new TypedData<{ a: number }>({ a: 1 });

    // biome-ignore lint/suspicious/noExplicitAny: exercising the unknown-key read guard
    const value = ctx.get('missing' as any);

    expect(value).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      '[uc][typed-data]',
      expect.stringMatching(/\[Typed State\] Wrong property name:/),
    );

    ctx.destroy();
    warn.mockRestore();
  });

  it('setMany applies several keys', () => {
    const d = make();
    d.setMany({ a: 2, b: 'x' });
    expect(d.get('a')).toBe(2);
    expect(d.get('b')).toBe('x');
    d.destroy();
  });

  it('clearing an optional key to undefined is observed (not dropped)', () => {
    // The behavior FileItemConfig.subEntry relies on: setting a field back to
    // `undefined` (e.g. a removed thumbUrl/fileName) must reach observers.
    const d = new TypedData<{ a?: number }>({ a: 5 });
    const seen: (number | undefined)[] = [];
    d.observe('a', (v) => seen.push(v)); // no immediate
    d.set('a', undefined);
    expect(d.get('a')).toBeUndefined();
    expect(seen).toEqual([undefined]);
    d.destroy();
  });

  it('values returns the live bag', () => {
    const d = make();
    d.set('a', 9);
    expect(d.values.a).toBe(9);
    d.destroy();
  });

  it('getTracked reads the current value', () => {
    const d = make();
    expect(d.getTracked('a')).toBe(0);
    d.set('a', 5);
    expect(d.getTracked('a')).toBe(5);
    d.destroy();
  });

  it('subscribe fires coarsely on any key change', () => {
    const d = make();
    const listener = vi.fn();
    d.subscribe(listener);
    d.set('a', 1);
    expect(listener).toHaveBeenCalledTimes(1);
    d.set('b', 'y');
    expect(listener).toHaveBeenCalledTimes(2);
    d.destroy();
  });

  it('notify() forces a coarse notification with no state change', () => {
    const d = make();
    const listener = vi.fn();
    d.subscribe(listener);
    d.notify();
    expect(listener).toHaveBeenCalledTimes(1);
    d.destroy();
  });

  it('observe fires immediately then per-key', () => {
    const d = make();
    const seen: (number | undefined)[] = [];
    d.observe('a', (v) => seen.push(v), { immediate: true });
    d.set('a', 3);
    d.set('b', 'y'); // unrelated
    expect(seen).toEqual([0, 3]);
    d.destroy();
  });

  it('observe only notifies when the value actually changes (Object.is dedup)', () => {
    const d = make();
    const handler = vi.fn();
    d.observe('a', handler, { immediate: true });
    handler.mockClear();

    // Same value => no notify.
    d.set('a', 0);
    expect(handler).not.toHaveBeenCalled();

    // Changed value => notify.
    d.set('a', 2);
    expect(d.get('a')).toBe(2);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenLastCalledWith(2);

    d.destroy();
  });

  it('unobserve (the returned unsubscribe fn) stops notifications', () => {
    const d = make();
    const handler = vi.fn();
    const off = d.observe('a', handler, { immediate: true });
    handler.mockClear();
    off();

    d.set('a', 2);
    expect(handler).not.toHaveBeenCalled();
    d.destroy();
  });

  it('isolates a throwing observer so other observers still run', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const d = make();
    const bad = vi.fn(() => {
      throw new Error('boom');
    });
    const good = vi.fn();
    // Registered WITHOUT `{ immediate: true }`: isolates a throwing observer
    // during a change NOTIFICATION (the `set` below) — `Listeners.notify`
    // catches per-listener and warns rather than aborting the fan-out.
    d.observe('a', bad);
    d.observe('a', good);

    expect(() => d.set('a', 2)).not.toThrow();
    expect(good).toHaveBeenCalledWith(2);
    expect(warn).toHaveBeenCalled();

    d.destroy();
  });

  it('isolates a throwing observer registered with { immediate: true }', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const d = make();
    const bad = vi.fn(() => {
      throw new Error('boom');
    });

    // The immediate registration-time fire is isolated the same way as a
    // later notification (`Listeners.observe` wraps it in try/catch + warn).
    expect(() => d.observe('a', bad, { immediate: true })).not.toThrow();
    expect(bad).toHaveBeenCalledWith(0);
    expect(warn).toHaveBeenCalled();

    d.destroy();
  });

  it('warns and skips an unknown key on set', () => {
    const d = make();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // @ts-expect-error unknown key
    d.set('nope', 1);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    expect('nope' in d.values).toBe(false);
    d.destroy();
  });

  it('warns and skips an unknown key on setMany, but still applies known keys', () => {
    const d = make();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // @ts-expect-error unknown key mixed with a known one
    d.setMany({ a: 7, nope: 1 });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    expect(d.get('a')).toBe(7);
    expect('nope' in d.values).toBe(false);
    d.destroy();
  });

  it('getByUid returns the entry until destroyed', () => {
    const d = make();
    expect(TypedData.getByUid(d.uid)).toBe(d);
    d.destroy();
    expect(TypedData.getByUid(d.uid)).toBeNull();
  });
});
