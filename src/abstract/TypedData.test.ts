import { afterEach, describe, expect, it, vi } from 'vitest';
import { TypedData } from './TypedData';

describe('TypedData (legacy aliases)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it('snapshot() returns the full current field object', () => {
    const ctx = new TypedData<{ a: number; b: string }>({ a: 1, b: 'x' });
    expect(ctx.snapshot()).toEqual({ a: 1, b: 'x' });
    ctx.setValue('a', 2);
    expect(ctx.snapshot().a).toBe(2);
    ctx.destroy();
  });

  it('getValue/setValue read and update values; setValue only notifies when changed', () => {
    const ctx = new TypedData<{ a: number }>({ a: 1 });

    expect(ctx.getValue('a')).toBe(1);

    const handler = vi.fn();
    // Old per-key `subscribe(prop, handler)` immediate-fire semantics now live
    // in `observe(key, handler, { immediate: true })`.
    ctx.observe('a', handler, { immediate: true });

    // observe fires the initial value immediately (parity with the previous
    // PubSub.sub(..., init=true) behavior).
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenLastCalledWith(1);
    handler.mockClear();

    // Same value => no notify.
    ctx.setValue('a', 1);
    expect(handler).not.toHaveBeenCalled();

    // Changed value => notify.
    ctx.setValue('a', 2);
    expect(ctx.getValue('a')).toBe(2);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenLastCalledWith(2);

    ctx.destroy();
  });

  it('unsubscribe stops notifications', () => {
    const ctx = new TypedData<{ a: number }>({ a: 1 });
    const handler = vi.fn();
    const off = ctx.observe('a', handler, { immediate: true });
    handler.mockClear();
    off();

    ctx.setValue('a', 2);
    expect(handler).not.toHaveBeenCalled();
    ctx.destroy();
  });

  it('only notifies subscribers of the changed property (per-key)', () => {
    const ctx = new TypedData<{ a: number; b: number }>({ a: 1, b: 1 });
    const onA = vi.fn();
    const onB = vi.fn();
    ctx.observe('a', onA, { immediate: true });
    ctx.observe('b', onB, { immediate: true });
    onA.mockClear();
    onB.mockClear();

    ctx.setValue('a', 2);
    expect(onA).toHaveBeenCalledTimes(1);
    expect(onB).not.toHaveBeenCalled();

    ctx.destroy();
  });

  it('isolates a throwing subscriber so other subscribers still run', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ctx = new TypedData<{ a: number }>({ a: 1 });
    const bad = vi.fn(() => {
      throw new Error('boom');
    });
    const good = vi.fn();
    // Registered WITHOUT `{ immediate: true }`: this test isolates a throwing
    // subscriber during a change NOTIFICATION (the `setValue` below), which is
    // what `Listeners.notify` isolates. An immediate registration-time fire is
    // not wrapped in the same isolation, so it's out of scope here.
    ctx.observe('a', bad);
    ctx.observe('a', good);

    expect(() => ctx.setValue('a', 2)).not.toThrow();
    expect(good).toHaveBeenCalledWith(2);
    expect(warn).toHaveBeenCalled();

    ctx.destroy();
  });

  it('setMultipleValues updates multiple properties via setValue', () => {
    const ctx = new TypedData<{ a: number; b: number }>({ a: 1, b: 10 });

    ctx.setMultipleValues({ a: 2, b: 20 });

    expect(ctx.getValue('a')).toBe(2);
    expect(ctx.getValue('b')).toBe(20);

    ctx.destroy();
  });

  it('warns and does nothing when setting an unknown property', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const ctx = new TypedData<{ a: number }>({ a: 1 });
    // biome-ignore lint/suspicious/noExplicitAny: testing the unknown-key guard
    ctx.setValue('missing' as any, 123);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toBe('[uc][typed-data]');
    expect(warnSpy.mock.calls[0]?.[1]).toMatch(/\[Typed State\] Wrong property name:/);
    expect(ctx.getValue('a')).toBe(1);

    ctx.destroy();
  });

  it('destroy() removes the entry from the registry', () => {
    const ctx = new TypedData<{ a: number }>({ a: 1 });
    const id = ctx.uid;
    expect(TypedData.getByUid(id)).toBe(ctx);

    ctx.destroy();
    expect(TypedData.getByUid(id)).toBeNull();
  });

  it('warns when reading an unknown property and returns undefined', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ctx = new TypedData<{ a: number }>({ a: 1 });

    // biome-ignore lint/suspicious/noExplicitAny: exercising the unknown-key read guard
    const value = ctx.getValue('missing' as any);

    expect(value).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      '[uc][typed-data]',
      expect.stringMatching(/\[Typed State\] Wrong property name:/),
    );

    ctx.destroy();
    warn.mockRestore();
  });
});

describe('TypedData (ReactiveStore)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const make = () => new TypedData<{ a: number; b: string }>({ a: 0, b: '' });

  it('get/set with Object.is dedup', () => {
    const d = make();
    expect(d.get('a')).toBe(0);
    d.set('a', 1);
    expect(d.get('a')).toBe(1);
    d.destroy();
  });

  it('setMany applies several keys', () => {
    const d = make();
    d.setMany({ a: 2, b: 'x' });
    expect(d.get('a')).toBe(2);
    expect(d.get('b')).toBe('x');
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
