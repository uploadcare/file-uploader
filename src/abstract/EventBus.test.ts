import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigController } from './controllers/ConfigController';
import { ControllerContainer } from './di/ControllerContainer';
import { EventBus, UploaderEventType } from './EventBus';

describe('EventBus', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('delivers an emitted payload to its listener', () => {
    const bus = new ControllerContainer().get(EventBus);
    const handler = vi.fn();
    bus.on(UploaderEventType.UPLOAD_CLICK, handler);

    bus.emit(UploaderEventType.UPLOAD_CLICK, undefined);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('stops delivery after unsubscribe', () => {
    const bus = new ControllerContainer().get(EventBus);
    const handler = vi.fn();
    const off = bus.on(UploaderEventType.UPLOAD_CLICK, handler);

    off();
    bus.emit(UploaderEventType.UPLOAD_CLICK, undefined);

    expect(handler).not.toHaveBeenCalled();
  });

  it('isolates a throwing listener so others still run', () => {
    const bus = new ControllerContainer().get(EventBus);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bad = vi.fn(() => {
      throw new Error('boom');
    });
    const good = vi.fn();
    bus.on(UploaderEventType.UPLOAD_CLICK, bad);
    bus.on(UploaderEventType.UPLOAD_CLICK, good);

    expect(() => bus.emit(UploaderEventType.UPLOAD_CLICK, undefined)).not.toThrow();
    expect(good).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('onAny receives the type and payload of every event', () => {
    const bus = new ControllerContainer().get(EventBus);
    const any = vi.fn();
    bus.onAny(any);

    bus.emit(UploaderEventType.UPLOAD_CLICK, undefined);

    expect(any).toHaveBeenCalledWith(UploaderEventType.UPLOAD_CLICK, undefined);
  });

  it('emitDebounced fires once after the window and evaluates the thunk lazily', () => {
    vi.useFakeTimers();
    const bus = new ControllerContainer().get(EventBus);
    const handler = vi.fn();
    const thunk = vi.fn(() => undefined);
    bus.on(UploaderEventType.UPLOAD_CLICK, handler);

    bus.emitDebounced(UploaderEventType.UPLOAD_CLICK, thunk);
    bus.emitDebounced(UploaderEventType.UPLOAD_CLICK, thunk);
    expect(handler).not.toHaveBeenCalled();

    vi.advanceTimersByTime(20);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(thunk).toHaveBeenCalledTimes(1);
  });

  it('destroy() clears listeners and pending debounced emits', () => {
    vi.useFakeTimers();
    const bus = new ControllerContainer().get(EventBus);
    const handler = vi.fn();
    bus.on(UploaderEventType.UPLOAD_CLICK, handler);
    bus.emitDebounced(UploaderEventType.UPLOAD_CLICK, () => undefined);

    bus.destroy();
    vi.advanceTimersByTime(20);
    bus.emit(UploaderEventType.UPLOAD_CLICK, undefined);

    expect(handler).not.toHaveBeenCalled();
  });

  it('emit is a no-op for a type with no listeners', () => {
    const bus = new ControllerContainer().get(EventBus);
    expect(() => bus.emit(UploaderEventType.UPLOAD_CLICK, undefined)).not.toThrow();
  });

  it('drops the listener set on full unsubscribe and re-subscribes cleanly', () => {
    const bus = new ControllerContainer().get(EventBus);
    const first = vi.fn();
    const off = bus.on(UploaderEventType.UPLOAD_CLICK, first);
    off(); // last listener removed → backing Set is deleted

    const second = vi.fn();
    bus.on(UploaderEventType.UPLOAD_CLICK, second);
    bus.emit(UploaderEventType.UPLOAD_CLICK, undefined);

    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });

  it('isolates a throwing payload thunk in emitDebounced', () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bus = new ControllerContainer().get(EventBus);
    const handler = vi.fn();
    bus.on(UploaderEventType.UPLOAD_CLICK, handler);

    bus.emitDebounced(UploaderEventType.UPLOAD_CLICK, () => {
      throw new Error('thunk boom');
    });

    expect(() => vi.advanceTimersByTime(20)).not.toThrow();
    expect(handler).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('onAny returns an unsubscribe that stops delivery', () => {
    const bus = new ControllerContainer().get(EventBus);
    const any = vi.fn();
    const off = bus.onAny(any);

    off();
    bus.emit(UploaderEventType.UPLOAD_CLICK, undefined);

    expect(any).not.toHaveBeenCalled();
  });

  describe('after the ctx is disposed', () => {
    it('drops an event raised during teardown, a pending debounced one, and a later one', () => {
      vi.useFakeTimers();
      const container = new ControllerContainer();
      const bus = container.get(EventBus);
      const any = vi.fn();
      bus.onAny(any);
      // Built after the bus, so the container destroys it first — while the bus still has its listeners.
      class EmitsOnTeardown {
        public destroy(): void {
          bus.emit(UploaderEventType.UPLOAD_CLICK, undefined);
        }
      }
      container.get(EmitsOnTeardown);
      bus.emitDebounced(UploaderEventType.CHANGE, () => ({}) as never);

      container.dispose();
      bus.emit(UploaderEventType.UPLOAD_CLICK, undefined);
      vi.advanceTimersByTime(20);

      expect(any).not.toHaveBeenCalled();
    });
  });

  describe('event logging', () => {
    afterEach(() => vi.restoreAllMocks());

    it('logs each emitted event readably when this ctx has debug on (shallow-copying object payloads)', () => {
      const container = new ControllerContainer();
      container.get(ConfigController).set('debug', true);
      const bus = container.get(EventBus);
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});

      const payload = { internalId: 'a' };
      bus.emit(UploaderEventType.FILE_ADDED, payload as never);

      // Verbose badge chips (uc + scope; no ctx-name — container built directly),
      // then the readable `event <type>` label and the payload.
      expect(log).toHaveBeenCalledWith(
        '%c uc %c event-bus %c',
        expect.any(String),
        expect.any(String),
        '',
        '→ file-added',
        payload,
      );
      // The logged payload is a shallow copy, not the live reference.
      const loggedPayload = log.mock.calls.at(-1)?.at(-1);
      expect(loggedPayload).toEqual(payload);
      expect(loggedPayload).not.toBe(payload);
    });

    it('does not log events when this ctx has debug off', () => {
      const container = new ControllerContainer();
      const bus = container.get(EventBus);
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});

      bus.emit(UploaderEventType.FILE_ADDED, { internalId: 'a' } as never);

      expect(log).not.toHaveBeenCalled();
    });
  });
});
