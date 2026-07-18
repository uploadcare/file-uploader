import { describe, expect, it, vi } from 'vitest';
import { ControllerContainer } from './di/ControllerContainer';
import { UploaderRegistry } from './UploaderRegistry';

// The registry is a module-level singleton, so each test uses a unique
// ctx-name and unregisters what it created to avoid cross-test bleed.
let seq = 0;
const uniqueName = () => `test-ctx-${seq++}`;

// M-god step 8e: the registry now stores the ctx's `ControllerContainer`
// directly (the `UploaderController` facade it once held is gone). These tests
// only exercise the registry's identity semantics, so each gets a throwaway
// container as the registered value.
const newController = () => new ControllerContainer();

describe('UploaderRegistry', () => {
  it('register then get returns the controller', () => {
    const name = uniqueName();
    const controller = newController();

    UploaderRegistry.register(name, controller);
    expect(UploaderRegistry.get(name)).toBe(controller);

    UploaderRegistry.unregister(name, controller);
    expect(UploaderRegistry.get(name)).toBeUndefined();
  });

  it('whenAvailable fires synchronously when already registered', () => {
    const name = uniqueName();
    const controller = newController();
    UploaderRegistry.register(name, controller);

    const cb = vi.fn();
    const off = UploaderRegistry.whenAvailable(name, cb);

    expect(cb).toHaveBeenCalledWith(controller);
    off();
    UploaderRegistry.unregister(name, controller);
  });

  it('whenAvailable fires when a controller registers later', () => {
    const name = uniqueName();
    const cb = vi.fn();
    const off = UploaderRegistry.whenAvailable(name, cb);
    expect(cb).not.toHaveBeenCalled();

    const controller = newController();
    UploaderRegistry.register(name, controller);

    expect(cb).toHaveBeenCalledWith(controller);
    off();
    UploaderRegistry.unregister(name, controller);
  });

  it('re-registering under the same name re-notifies consumers (remount)', () => {
    const name = uniqueName();
    const first = newController();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    UploaderRegistry.register(name, first);

    const cb = vi.fn();
    const off = UploaderRegistry.whenAvailable(name, cb);
    cb.mockClear();

    const second = newController();
    UploaderRegistry.register(name, second);

    expect(cb).toHaveBeenCalledWith(second);
    expect(warn).toHaveBeenCalled();

    off();
    UploaderRegistry.unregister(name, second);
    warn.mockRestore();
  });

  it('isolates a throwing consumer so other consumers are still notified on register', () => {
    const name = uniqueName();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bad = vi.fn(() => {
      throw new Error('boom');
    });
    const good = vi.fn();
    UploaderRegistry.whenAvailable(name, bad);
    const off = UploaderRegistry.whenAvailable(name, good);

    const controller = newController();
    expect(() => UploaderRegistry.register(name, controller)).not.toThrow();
    expect(good).toHaveBeenCalledWith(controller);
    expect(warn).toHaveBeenCalled();

    off();
    UploaderRegistry.unregister(name, controller);
    warn.mockRestore();
  });

  it('unregister only deletes when the controller identity matches', () => {
    const name = uniqueName();
    const current = newController();
    const stale = newController();
    UploaderRegistry.register(name, current);

    // A stale element's deferred unregister must not evict the new owner.
    UploaderRegistry.unregister(name, stale);
    expect(UploaderRegistry.get(name)).toBe(current);

    UploaderRegistry.unregister(name, current);
    expect(UploaderRegistry.get(name)).toBeUndefined();
  });

  it('unregister notifies consumers with null', () => {
    const name = uniqueName();
    const controller = newController();
    UploaderRegistry.register(name, controller);

    const cb = vi.fn();
    const off = UploaderRegistry.whenAvailable(name, cb);
    cb.mockClear();

    UploaderRegistry.unregister(name, controller);

    expect(cb).toHaveBeenCalledWith(null);
    off();
  });

  it('unregister of a stale controller does not notify consumers', () => {
    const name = uniqueName();
    const current = newController();
    const stale = newController();
    UploaderRegistry.register(name, current);

    const cb = vi.fn();
    const off = UploaderRegistry.whenAvailable(name, cb);
    cb.mockClear();

    UploaderRegistry.unregister(name, stale);

    expect(cb).not.toHaveBeenCalled();

    off();
    UploaderRegistry.unregister(name, current);
  });

  it('re-registering after an unregister fires the new controller', () => {
    const name = uniqueName();
    const first = newController();
    UploaderRegistry.register(name, first);

    const cb = vi.fn();
    const off = UploaderRegistry.whenAvailable(name, cb);
    cb.mockClear();

    UploaderRegistry.unregister(name, first);
    expect(cb).toHaveBeenCalledWith(null);
    cb.mockClear();

    const second = newController();
    UploaderRegistry.register(name, second);
    expect(cb).toHaveBeenCalledWith(second);

    off();
    UploaderRegistry.unregister(name, second);
  });

  it('isolates a throwing consumer so other consumers are still notified on unregister', () => {
    const name = uniqueName();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const controller = newController();

    const bad = vi.fn(() => {
      throw new Error('boom');
    });
    const good = vi.fn();
    const offBad = UploaderRegistry.whenAvailable(name, bad);
    const offGood = UploaderRegistry.whenAvailable(name, good);
    UploaderRegistry.register(name, controller);
    bad.mockClear();
    good.mockClear();
    warn.mockClear();

    expect(() => UploaderRegistry.unregister(name, controller)).not.toThrow();
    expect(good).toHaveBeenCalledWith(null);
    expect(warn).toHaveBeenCalled();

    offBad();
    offGood();
    warn.mockRestore();
  });

  it('unsubscribe stops further notifications', () => {
    const name = uniqueName();
    const cb = vi.fn();
    const off = UploaderRegistry.whenAvailable(name, cb);
    off();

    const controller = newController();
    UploaderRegistry.register(name, controller);

    expect(cb).not.toHaveBeenCalled();
    UploaderRegistry.unregister(name, controller);
  });

  // Pin ahead of the M9o unified-teardown change, which will treat this
  // consumer set as a live refcount (ctx dies when it's empty AND
  // blocksRegistry is empty). These pin the set's cardinality semantics
  // directly: N subscribers -> N independent slots, each unsub removes
  // exactly one, and the set only "empties" (stops notifying anyone) once
  // every subscriber has unsubscribed.
  it('consumer count is a faithful live refcount: N subscriptions -> N independent slots', () => {
    const name = uniqueName();
    const a = vi.fn();
    const b = vi.fn();
    const c = vi.fn();
    const offA = UploaderRegistry.whenAvailable(name, a);
    const offB = UploaderRegistry.whenAvailable(name, b);
    const offC = UploaderRegistry.whenAvailable(name, c);

    const controller = newController();
    UploaderRegistry.register(name, controller);
    expect(a).toHaveBeenCalledWith(controller);
    expect(b).toHaveBeenCalledWith(controller);
    expect(c).toHaveBeenCalledWith(controller);
    a.mockClear();
    b.mockClear();
    c.mockClear();

    // Unsubscribing one of three removes exactly that one slot — the other
    // two remain live and keep receiving notifications.
    offB();
    const second = newController();
    UploaderRegistry.register(name, second);
    expect(a).toHaveBeenCalledWith(second);
    expect(c).toHaveBeenCalledWith(second);
    expect(b).not.toHaveBeenCalled();
    a.mockClear();
    c.mockClear();

    // Unsubscribing the remaining two empties the set: a subsequent
    // register notifies nobody.
    offA();
    offC();
    const third = newController();
    expect(() => UploaderRegistry.register(name, third)).not.toThrow();
    expect(a).not.toHaveBeenCalled();
    expect(c).not.toHaveBeenCalled();

    UploaderRegistry.unregister(name, third);
  });

  // M9o Task 3: `hasConsumers` is the query the unified teardown predicate
  // reads to decide whether a v2 `ChildBlock` is still watching a ctx.
  describe('hasConsumers', () => {
    it('is false when nobody is watching the name', () => {
      const name = uniqueName();
      expect(UploaderRegistry.hasConsumers(name)).toBe(false);
    });

    it('is true while at least one whenAvailable subscription is live', () => {
      const name = uniqueName();
      const offA = UploaderRegistry.whenAvailable(name, vi.fn());
      expect(UploaderRegistry.hasConsumers(name)).toBe(true);

      const offB = UploaderRegistry.whenAvailable(name, vi.fn());
      expect(UploaderRegistry.hasConsumers(name)).toBe(true);

      offA();
      expect(UploaderRegistry.hasConsumers(name)).toBe(true);

      offB();
      expect(UploaderRegistry.hasConsumers(name)).toBe(false);
    });

    it('is unaffected by whether a controller is registered under the name', () => {
      const name = uniqueName();
      const controller = newController();
      UploaderRegistry.register(name, controller);
      expect(UploaderRegistry.hasConsumers(name)).toBe(false);

      const off = UploaderRegistry.whenAvailable(name, vi.fn());
      expect(UploaderRegistry.hasConsumers(name)).toBe(true);

      UploaderRegistry.unregister(name, controller);
      expect(UploaderRegistry.hasConsumers(name)).toBe(true);

      off();
      expect(UploaderRegistry.hasConsumers(name)).toBe(false);
    });
  });

  // M9o review finding: `_consumers` must track each `whenAvailable` call as
  // a distinct subscription, not dedupe by callback identity. Two
  // subscriptions sharing the same callback reference are independent
  // slots — unsubscribing one must not silence or evict the other.
  it('two whenAvailable subscriptions sharing the same callback are independent slots', () => {
    const name = uniqueName();
    const cb = vi.fn();
    const offFirst = UploaderRegistry.whenAvailable(name, cb);
    const offSecond = UploaderRegistry.whenAvailable(name, cb);

    const controller = newController();
    UploaderRegistry.register(name, controller);
    // Both subscriptions notify independently, even though it's the same
    // function reference — one call per live subscription, not deduped.
    expect(cb).toHaveBeenCalledTimes(2);
    expect(cb).toHaveBeenCalledWith(controller);
    cb.mockClear();

    // Unsubscribing just one of the two must leave the other live.
    offFirst();
    expect(UploaderRegistry.hasConsumers(name)).toBe(true);

    const second = newController();
    UploaderRegistry.register(name, second);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(second);
    cb.mockClear();

    offSecond();
    expect(UploaderRegistry.hasConsumers(name)).toBe(false);

    UploaderRegistry.unregister(name, second);
  });
});
