import { afterEach, describe, expect, it, vi } from 'vitest';
import { PubSub } from '../lit/PubSubCompat';
import { TypedData } from './TypedData';

describe('TypedData', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a unique context id and registers a PubSub context', () => {
    const ctx1 = new TypedData<{ a: number }>({ a: 1 });
    const ctx2 = new TypedData<{ a: number }>({ a: 2 });

    expect(ctx1.uid).toBeTruthy();
    expect(ctx2.uid).toBeTruthy();
    expect(ctx1.uid).not.toBe(ctx2.uid);

    expect(PubSub.hasCtx(ctx1.uid)).toBe(true);
    expect(PubSub.hasCtx(ctx2.uid)).toBe(true);

    ctx1.destroy();
    ctx2.destroy();
  });

  it('getValue/setValue read and update values; setValue only publishes when changed', () => {
    const ctx = new TypedData<{ a: number }>({ a: 1 });

    expect(ctx.getValue('a')).toBe(1);

    const handler = vi.fn();
    ctx.subscribe('a', handler);

    // PubSub subscriptions emit the initial value.
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenLastCalledWith(1);
    handler.mockClear();

    // Same value => no publish.
    ctx.setValue('a', 1);
    expect(handler).not.toHaveBeenCalled();

    // Changed value => publish.
    ctx.setValue('a', 2);
    expect(ctx.getValue('a')).toBe(2);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenLastCalledWith(2);

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
    ctx.setValue('missing' as any, 123);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toMatch(/\[Typed State\] Wrong property name:/);

    // Original value is intact.
    expect(ctx.getValue('a')).toBe(1);

    ctx.destroy();
  });

  it('destroy() unregisters the PubSub context', () => {
    const ctx = new TypedData<{ a: number }>({ a: 1 });
    const id = ctx.uid;

    expect(PubSub.hasCtx(id)).toBe(true);

    ctx.destroy();
    expect(PubSub.hasCtx(id)).toBe(false);
  });
});
