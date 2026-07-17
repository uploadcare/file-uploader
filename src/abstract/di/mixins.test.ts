import { afterEach, describe, expect, it, vi } from 'vitest';
import { Disposable, Subscribable } from './mixins';

describe('Disposable', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('runs disposers in reverse (LIFO) order on destroy()', () => {
    const order: number[] = [];
    class Base {}
    const instance = new (Disposable(Base))();
    instance.addDisposer(() => order.push(1));
    instance.addDisposer(() => order.push(2));
    instance.addDisposer(() => order.push(3));

    instance.destroy();

    expect(order).toEqual([3, 2, 1]);
  });

  it('isolates a throwing disposer and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const good = vi.fn();
    const instance = new (Disposable(class {}))();
    instance.addDisposer(good);
    instance.addDisposer(() => {
      throw new Error('boom');
    });

    expect(() => instance.destroy()).not.toThrow();
    // The throwing disposer runs first (LIFO); `good` must still run.
    expect(good).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('[uc] a disposer threw', expect.any(Error));
  });

  it('clears disposers so a second destroy() is a no-op', () => {
    const run = vi.fn();
    const instance = new (Disposable(class {}))();
    instance.addDisposer(run);

    instance.destroy();
    instance.destroy();

    expect(run).toHaveBeenCalledTimes(1);
  });

  it('preserves the base class members', () => {
    class Base {
      public greeting = 'hi';
    }
    const instance = new (Disposable(Base))();
    expect(instance.greeting).toBe('hi');
  });
});

describe('Subscribable', () => {
  it('notifies subscribers and supports unsubscribe', () => {
    const listener = vi.fn();
    const instance = new (Subscribable(class {}))();
    const unsubscribe = instance.subscribe(listener);

    instance.notify();
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    instance.notify();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
