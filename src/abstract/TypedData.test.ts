import { afterEach, describe, expect, it, vi } from 'vitest';
import { TypedData } from './TypedData';

describe('TypedData', () => {
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
    ctx.subscribe('a', handler);

    // subscribe emits the initial value immediately (parity with the previous
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
    const off = ctx.subscribe('a', handler);
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
    ctx.subscribe('a', onA);
    ctx.subscribe('b', onB);
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
    ctx.subscribe('a', bad);
    ctx.subscribe('a', good);
    bad.mockClear();
    good.mockClear();

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
    expect(warnSpy.mock.calls[0]?.[0]).toMatch(/\[Typed State\] Wrong property name:/);
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
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/\[Typed State\] Wrong property name:/));

    ctx.destroy();
    warn.mockRestore();
  });
});
