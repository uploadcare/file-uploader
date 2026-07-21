import { afterEach, describe, expect, it, vi } from 'vitest';
import { Listeners } from './host-subscription';

describe('Listeners', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('notifies every subscribed listener', () => {
    const listeners = new Listeners();
    const a = vi.fn();
    const b = vi.fn();
    listeners.subscribe(a);
    listeners.subscribe(b);

    listeners.notify();

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('stops notifying after the returned unsubscribe is called', () => {
    const listeners = new Listeners();
    const a = vi.fn();
    const unsubscribe = listeners.subscribe(a);

    unsubscribe();
    listeners.notify();

    expect(a).not.toHaveBeenCalled();
  });

  it('isolates a throwing listener so the others still run', () => {
    const listeners = new Listeners();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bad = vi.fn(() => {
      throw new Error('boom');
    });
    const good = vi.fn();
    listeners.subscribe(bad);
    listeners.subscribe(good);

    expect(() => listeners.notify()).not.toThrow();
    expect(good).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('clear() removes all listeners', () => {
    const listeners = new Listeners();
    const a = vi.fn();
    listeners.subscribe(a);

    listeners.clear();
    listeners.notify();

    expect(a).not.toHaveBeenCalled();
  });

  describe('observe', () => {
    it('fires the immediate listener with the current value on subscribe', () => {
      const listeners = new Listeners();
      const value = 1;
      const seen: number[] = [];

      listeners.observe(
        () => value,
        (v) => seen.push(v),
        { immediate: true },
      );

      expect(seen).toEqual([1]);
    });

    it('only calls listener when the selected value actually changes (Object.is dedup)', () => {
      const listeners = new Listeners();
      let value = 1;
      const seen: number[] = [];
      listeners.observe(
        () => value,
        (v) => seen.push(v),
      );

      value = 1;
      listeners.notify(); // unchanged — no call
      expect(seen).toEqual([]);

      value = 2;
      listeners.notify();
      expect(seen).toEqual([2]);
    });

    it('registers the subscription BEFORE firing the immediate listener, so a value change made synchronously from inside that listener (which itself triggers a notify) is observed rather than missed', () => {
      const listeners = new Listeners();
      let value = 1;
      const seen: number[] = [];

      listeners.observe(
        () => value,
        (v) => {
          seen.push(v);
          if (v === 1) {
            // Simulate a synchronous cascading change made from inside the
            // immediate listener itself — e.g. it writes some other state whose
            // setter synchronously calls `notify()`. If `subscribe` ran AFTER
            // this immediate call (the old ordering), this `notify()` would fire
            // while our observer isn't registered yet, so the 1 -> 2 transition
            // would be silently missed and `last` would go stale at 1.
            value = 2;
            listeners.notify();
          }
        },
        { immediate: true },
      );

      // Both the immediate value (1) and the synchronously-triggered change (2)
      // were observed — proof the subscription was live during the immediate
      // call, not registered after it.
      expect(seen).toEqual([1, 2]);

      // `last` is correctly at 2 now (not stale at 1): a no-op notify at the
      // same value produces no further call...
      listeners.notify();
      expect(seen).toEqual([1, 2]);

      // ...and a real subsequent change is still observed correctly.
      value = 3;
      listeners.notify();
      expect(seen).toEqual([1, 2, 3]);
    });

    it('isolates a throwing immediate listener so it does not prevent subscription', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const listeners = new Listeners();
      let value = 1;
      const seen: number[] = [];

      expect(() =>
        listeners.observe(
          () => value,
          () => {
            throw new Error('boom');
          },
          { immediate: true },
        ),
      ).not.toThrow();
      expect(warn).toHaveBeenCalled();

      // Subsequent (non-throwing) reactive notifications still work — proves the
      // subscription is live despite the immediate listener throwing.
      listeners.observe(
        () => value,
        (v) => seen.push(v),
      );
      value = 2;
      listeners.notify();
      expect(seen).toEqual([2]);
    });

    it('returns an unsubscribe that stops further notifications', () => {
      const listeners = new Listeners();
      let value = 1;
      const seen: number[] = [];
      const unsubscribe = listeners.observe(
        () => value,
        (v) => seen.push(v),
      );

      unsubscribe();
      value = 2;
      listeners.notify();

      expect(seen).toEqual([]);
    });
  });
});
