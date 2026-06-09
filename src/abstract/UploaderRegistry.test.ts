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
});
