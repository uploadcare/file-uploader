import { describe, expect, it, vi } from 'vitest';
import { ConfigController } from './controllers/ConfigController';
import { RouterController } from './controllers/RouterController';
import { ControllerContainer } from './di/ControllerContainer';
import { UploaderEventType } from './EventBus';
import { EventEmitter } from './EventEmitter';
import { TelemetryManager } from './managers/TelemetryManager';
import { UploaderRegistry } from './UploaderRegistry';

// The registry is a module-level singleton, so each test uses a unique
// ctx-name and disposes what it created to avoid cross-test bleed.
let seq = 0;
const uniqueName = () => `test-ctx-${seq++}`;

describe('UploaderRegistry', () => {
  it('whenAvailable fires synchronously when already registered', () => {
    const name = uniqueName();
    const container = UploaderRegistry.ensure(name);

    const cb = vi.fn();
    const off = UploaderRegistry.whenAvailable(name, cb);

    expect(cb).toHaveBeenCalledWith(container);
    off();
    UploaderRegistry.dispose(name);
  });

  it('whenAvailable fires when a container registers later', () => {
    const name = uniqueName();
    const cb = vi.fn();
    const off = UploaderRegistry.whenAvailable(name, cb);
    expect(cb).not.toHaveBeenCalled();

    const container = UploaderRegistry.ensure(name);

    expect(cb).toHaveBeenCalledWith(container);
    off();
    UploaderRegistry.dispose(name);
  });

  it('isolates a throwing consumer so other consumers are still notified on ensure', () => {
    const name = uniqueName();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bad = vi.fn(() => {
      throw new Error('boom');
    });
    const good = vi.fn();
    const offBad = UploaderRegistry.whenAvailable(name, bad);
    const off = UploaderRegistry.whenAvailable(name, good);

    let container: ControllerContainer | undefined;
    expect(() => {
      container = UploaderRegistry.ensure(name);
    }).not.toThrow();
    expect(good).toHaveBeenCalledWith(container);
    expect(warn).toHaveBeenCalled();

    offBad();
    off();
    UploaderRegistry.dispose(name);
    warn.mockRestore();
  });

  it('re-ensuring after a dispose fires the new container', () => {
    const name = uniqueName();
    UploaderRegistry.ensure(name);

    const cb = vi.fn();
    const off = UploaderRegistry.whenAvailable(name, cb);
    cb.mockClear();

    UploaderRegistry.dispose(name);
    expect(cb).toHaveBeenCalledWith(null);
    cb.mockClear();

    const second = UploaderRegistry.ensure(name);
    expect(cb).toHaveBeenCalledWith(second);

    off();
    UploaderRegistry.dispose(name);
  });

  it('isolates a throwing consumer so other consumers are still notified on dispose', () => {
    const name = uniqueName();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const bad = vi.fn(() => {
      throw new Error('boom');
    });
    const good = vi.fn();
    const offBad = UploaderRegistry.whenAvailable(name, bad);
    const offGood = UploaderRegistry.whenAvailable(name, good);
    UploaderRegistry.ensure(name);
    bad.mockClear();
    good.mockClear();
    warn.mockClear();

    expect(() => UploaderRegistry.dispose(name)).not.toThrow();
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

    UploaderRegistry.ensure(name);

    expect(cb).not.toHaveBeenCalled();
    UploaderRegistry.dispose(name);
  });

  // N subscribers -> N independent slots, each unsub removes exactly one, and
  // the set only stops notifying once every subscriber has unsubscribed.
  it('N subscriptions -> N independent slots', () => {
    const name = uniqueName();
    const a = vi.fn();
    const b = vi.fn();
    const c = vi.fn();
    const offA = UploaderRegistry.whenAvailable(name, a);
    const offB = UploaderRegistry.whenAvailable(name, b);
    const offC = UploaderRegistry.whenAvailable(name, c);

    const container = UploaderRegistry.ensure(name);
    expect(a).toHaveBeenCalledWith(container);
    expect(b).toHaveBeenCalledWith(container);
    expect(c).toHaveBeenCalledWith(container);
    UploaderRegistry.dispose(name);
    a.mockClear();
    b.mockClear();
    c.mockClear();

    // Unsubscribing one of three removes exactly that one slot — the other
    // two remain live and keep receiving notifications.
    offB();
    const second = UploaderRegistry.ensure(name);
    expect(a).toHaveBeenCalledWith(second);
    expect(c).toHaveBeenCalledWith(second);
    expect(b).not.toHaveBeenCalled();
    a.mockClear();
    c.mockClear();

    // Unsubscribing the remaining two empties the set: a dispose notifies nobody.
    offA();
    offC();
    expect(() => UploaderRegistry.dispose(name)).not.toThrow();
    expect(a).not.toHaveBeenCalled();
    expect(c).not.toHaveBeenCalled();
  });

  // `_consumers` must track each `whenAvailable` call as a distinct
  // subscription, not dedupe by callback identity. Two subscriptions sharing
  // the same callback reference are independent slots — unsubscribing one must
  // not silence or evict the other.
  it('two whenAvailable subscriptions sharing the same callback are independent slots', () => {
    const name = uniqueName();
    const cb = vi.fn();
    const offFirst = UploaderRegistry.whenAvailable(name, cb);
    const offSecond = UploaderRegistry.whenAvailable(name, cb);

    const container = UploaderRegistry.ensure(name);
    // Both subscriptions notify independently, even though it's the same
    // function reference — one call per live subscription, not deduped.
    expect(cb).toHaveBeenCalledTimes(2);
    expect(cb).toHaveBeenCalledWith(container);
    UploaderRegistry.dispose(name);
    cb.mockClear();

    // Unsubscribing just one of the two must leave the other live.
    offFirst();

    const second = UploaderRegistry.ensure(name);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(second);

    offSecond();
    UploaderRegistry.dispose(name);
  });

  // The registry owns the container lifecycle: create + cache + eager
  // Config -> Router -> Telemetry init + dispose. Covered directly against it.
  describe('ensure / dispose (container lifecycle)', () => {
    it('ensure creates and caches one container per ctx-name', () => {
      const name = uniqueName();
      const c1 = UploaderRegistry.ensure(name);
      const c2 = UploaderRegistry.ensure(name);
      expect(c1).toBeInstanceOf(ControllerContainer);
      expect(c2).toBe(c1);
      // A different name gets a different container.
      const other = uniqueName();
      expect(UploaderRegistry.ensure(other)).not.toBe(c1);

      UploaderRegistry.dispose(name);
      UploaderRegistry.dispose(other);
    });

    it('ensure caches the container so get() sees it, and eagerly builds the config/router/telemetry set', () => {
      const name = uniqueName();
      const container = UploaderRegistry.ensure(name);
      expect(UploaderRegistry.get(name)).toBe(container);
      // `has()` is true only for already-constructed tokens — these three are
      // resolved by `ensure` itself, without any consumer `get()`.
      expect(container.has(ConfigController)).toBe(true);
      expect(container.has(RouterController)).toBe(true);
      expect(container.has(TelemetryManager)).toBe(true);

      UploaderRegistry.dispose(name);
    });

    it('the eagerly-constructed telemetry observes the ctx bus (init() ran at creation)', () => {
      const name = uniqueName();
      const container = UploaderRegistry.ensure(name);
      const telemetry = container.get(TelemetryManager);
      const sendEvent = vi.spyOn(telemetry, 'sendEvent');

      // Emitting on the ctx bus reaches telemetry only if its `init()` subscribed
      // at construction — proving the eager set wired the bus observer.
      container.get(EventEmitter).emit(UploaderEventType.UPLOAD_CLICK);
      expect(sendEvent).toHaveBeenCalled();

      UploaderRegistry.dispose(name);
    });

    it('ensure notifies a pre-existing whenAvailable consumer AFTER the eager init', () => {
      const name = uniqueName();
      let hadTelemetryAtNotify = false;
      const cb = vi.fn((c: ControllerContainer | null) => {
        // At notify time the eager set must already be constructed.
        if (c) hadTelemetryAtNotify = c.has(TelemetryManager);
      });
      const off = UploaderRegistry.whenAvailable(name, cb);
      expect(cb).not.toHaveBeenCalled(); // nothing registered yet

      const container = UploaderRegistry.ensure(name);
      expect(cb).toHaveBeenCalledWith(container);
      expect(hadTelemetryAtNotify).toBe(true);

      off();
      UploaderRegistry.dispose(name);
    });

    it('dispose null-notifies consumers, then disposes the container, then clears the map', () => {
      const name = uniqueName();
      const container = UploaderRegistry.ensure(name);
      const disposeSpy = vi.spyOn(container, 'dispose');
      const order: string[] = [];

      const off = UploaderRegistry.whenAvailable(name, (c) => {
        if (c === null) {
          order.push('null-notify');
          // Not yet disposed at null-notify time (consumers release first).
          expect(disposeSpy).not.toHaveBeenCalled();
        }
      });
      disposeSpy.mockImplementation(() => {
        order.push('dispose');
      });

      UploaderRegistry.dispose(name);

      expect(order).toEqual(['null-notify', 'dispose']);
      expect(UploaderRegistry.get(name)).toBeUndefined();
      off();
    });

    it('dispose is a no-op when no container exists for the name', () => {
      const name = uniqueName();
      expect(() => UploaderRegistry.dispose(name)).not.toThrow();
    });

    it('dispose is idempotent: a second dispose does not dispose the container again', () => {
      const name = uniqueName();
      const container = UploaderRegistry.ensure(name);
      const disposeSpy = vi.spyOn(container, 'dispose');

      UploaderRegistry.dispose(name);
      expect(disposeSpy).toHaveBeenCalledTimes(1);
      UploaderRegistry.dispose(name);
      expect(disposeSpy).toHaveBeenCalledTimes(1);
    });

    it('re-using a name after dispose builds a brand-new container', () => {
      const name = uniqueName();
      const first = UploaderRegistry.ensure(name);
      UploaderRegistry.dispose(name);
      const second = UploaderRegistry.ensure(name);
      expect(second).not.toBe(first);
      UploaderRegistry.dispose(name);
    });

    it('rolls the container back out of the map (and disposes it) when the eager init throws', () => {
      const name = uniqueName();
      const initSpy = vi.spyOn(TelemetryManager.prototype, 'init').mockImplementationOnce(() => {
        throw new Error('eager boom');
      });
      const disposeSpy = vi.spyOn(ControllerContainer.prototype, 'dispose');
      const consumer = vi.fn();
      const off = UploaderRegistry.whenAvailable(name, consumer);

      expect(() => UploaderRegistry.ensure(name)).toThrow('eager boom');
      // Rolled back: no partial container is left cached, the failed container is
      // disposed, and no consumer is ever notified of it.
      expect(UploaderRegistry.get(name)).toBeUndefined();
      expect(disposeSpy).toHaveBeenCalledTimes(1);
      expect(consumer).not.toHaveBeenCalled();

      initSpy.mockRestore();
      // A later `ensure()` retries a clean creation instead of returning the
      // skipped-init partial — the eager set is fully built and consumers fire.
      const container = UploaderRegistry.ensure(name);
      expect(container.has(TelemetryManager)).toBe(true);
      expect(consumer).toHaveBeenCalledWith(container);

      off();
      disposeSpy.mockRestore();
      UploaderRegistry.dispose(name);
    });
  });
});
