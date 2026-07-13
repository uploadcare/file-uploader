import { describe, expect, it, vi } from 'vitest';
import { UploaderController } from './controllers/UploaderController';
import { UploaderRegistry } from './UploaderRegistry';

// The registry is a module-level singleton, so each test uses a unique
// ctx-name and unregisters what it created to avoid cross-test bleed.
let seq = 0;
const uniqueName = () => `test-ctx-${seq++}`;

describe('UploaderRegistry', () => {
  it('register then get returns the controller', () => {
    const name = uniqueName();
    const controller = new UploaderController();

    UploaderRegistry.register(name, controller);
    expect(UploaderRegistry.get(name)).toBe(controller);

    UploaderRegistry.unregister(name, controller);
    expect(UploaderRegistry.get(name)).toBeUndefined();
  });

  it('whenAvailable fires synchronously when already registered', () => {
    const name = uniqueName();
    const controller = new UploaderController();
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

    const controller = new UploaderController();
    UploaderRegistry.register(name, controller);

    expect(cb).toHaveBeenCalledWith(controller);
    off();
    UploaderRegistry.unregister(name, controller);
  });

  it('re-registering under the same name re-notifies consumers (remount)', () => {
    const name = uniqueName();
    const first = new UploaderController();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    UploaderRegistry.register(name, first);

    const cb = vi.fn();
    const off = UploaderRegistry.whenAvailable(name, cb);
    cb.mockClear();

    const second = new UploaderController();
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

    const controller = new UploaderController();
    expect(() => UploaderRegistry.register(name, controller)).not.toThrow();
    expect(good).toHaveBeenCalledWith(controller);
    expect(warn).toHaveBeenCalled();

    off();
    UploaderRegistry.unregister(name, controller);
    warn.mockRestore();
  });

  it('unregister only deletes when the controller identity matches', () => {
    const name = uniqueName();
    const current = new UploaderController();
    const stale = new UploaderController();
    UploaderRegistry.register(name, current);

    // A stale element's deferred unregister must not evict the new owner.
    UploaderRegistry.unregister(name, stale);
    expect(UploaderRegistry.get(name)).toBe(current);

    UploaderRegistry.unregister(name, current);
    expect(UploaderRegistry.get(name)).toBeUndefined();
  });

  it('unregister notifies consumers with null', () => {
    const name = uniqueName();
    const controller = new UploaderController();
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
    const current = new UploaderController();
    const stale = new UploaderController();
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
    const first = new UploaderController();
    UploaderRegistry.register(name, first);

    const cb = vi.fn();
    const off = UploaderRegistry.whenAvailable(name, cb);
    cb.mockClear();

    UploaderRegistry.unregister(name, first);
    expect(cb).toHaveBeenCalledWith(null);
    cb.mockClear();

    const second = new UploaderController();
    UploaderRegistry.register(name, second);
    expect(cb).toHaveBeenCalledWith(second);

    off();
    UploaderRegistry.unregister(name, second);
  });

  it('isolates a throwing consumer so other consumers are still notified on unregister', () => {
    const name = uniqueName();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const controller = new UploaderController();

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

    const controller = new UploaderController();
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

    const controller = new UploaderController();
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
    const second = new UploaderController();
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
    const third = new UploaderController();
    expect(() => UploaderRegistry.register(name, third)).not.toThrow();
    expect(a).not.toHaveBeenCalled();
    expect(c).not.toHaveBeenCalled();

    UploaderRegistry.unregister(name, third);
  });
});
