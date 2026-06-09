import type { ReactiveController } from 'lit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventBus } from '../abstract/EventBus';
import { EventBridgeController } from './EventBridgeController';

// A minimal host that just records dispatchEvent calls. It intentionally does
// NOT extend EventTarget / call a real dispatch — doing so re-enters this method
// once per event phase (capture/target/bubble) and inflates the count.
class FakeHost {
  public controllers: ReactiveController[] = [];
  public events: CustomEvent[] = [];

  public addController(controller: ReactiveController): void {
    this.controllers.push(controller);
  }
  public removeController(): void {}
  public requestUpdate(): void {}
  public updateComplete = Promise.resolve(true);

  public dispatchEvent(event: Event): boolean {
    this.events.push(event as CustomEvent);
    return true;
  }
}

const makeHost = () => new FakeHost();
// The controller only needs `addController` + `dispatchEvent`; FakeHost provides both.
const asHostArg = (host: FakeHost) => host as unknown as ConstructorParameters<typeof EventBridgeController>[0];

describe('EventBridgeController', () => {
  let host: FakeHost;
  let bus: EventBus;

  beforeEach(() => {
    host = makeHost();
    bus = new EventBus();
  });

  afterEach(() => {
    bus.destroy();
    vi.restoreAllMocks();
  });

  it('registers itself as a controller on the host', () => {
    const controller = new EventBridgeController(asHostArg(host), () => bus);
    expect(host.controllers).toContain(controller);
  });

  it('subscribes on construction and dispatches bus events as CustomEvents on the host', () => {
    new EventBridgeController(asHostArg(host), () => bus);

    const payload = { internalId: 'a' } as never;
    bus.emit('file-added', payload);

    expect(host.events).toHaveLength(1);
    expect(host.events[0]?.type).toBe('file-added');
    expect(host.events[0]?.detail).toBe(payload);
  });

  it('does not double-subscribe when hostConnected fires while already subscribed', () => {
    const controller = new EventBridgeController(asHostArg(host), () => bus);
    controller.hostConnected(); // already subscribed in constructor → no-op

    bus.emit('file-removed', {} as never);

    expect(host.events).toHaveLength(1);
  });

  it('stops dispatching after hostDisconnected', () => {
    const controller = new EventBridgeController(asHostArg(host), () => bus);
    controller.hostDisconnected();

    bus.emit('file-added', {} as never);

    expect(host.events).toHaveLength(0);
  });

  it('re-subscribes on hostConnected after a disconnect', () => {
    const controller = new EventBridgeController(asHostArg(host), () => bus);
    controller.hostDisconnected();
    controller.hostConnected();

    bus.emit('file-added', {} as never);

    expect(host.events).toHaveLength(1);
  });

  it('logs each event via the debug hook (shallow-copying object payloads)', () => {
    // Invoke the thunk like the real `debugPrint` does, to capture the logged args.
    const logged: unknown[][] = [];
    const debug = vi.fn((...args: unknown[]) => {
      logged.push((args[0] as () => unknown[])());
    });
    new EventBridgeController(asHostArg(host), () => bus, debug);

    const payload = { internalId: 'a' };
    bus.emit('file-added', payload as never);
    bus.emit('upload-click', undefined); // non-object payload → passed through as-is

    expect(debug).toHaveBeenCalledTimes(2);
    expect(logged[0]?.[0]).toBe('event "file-added"');
    expect(logged[0]?.[1]).toEqual(payload);
    expect(logged[0]?.[1]).not.toBe(payload); // shallow copy, not the same ref
    expect(logged[1]?.[1]).toBeUndefined(); // undefined payload, not copied
  });

  it('does not throw when no debug hook is provided', () => {
    new EventBridgeController(asHostArg(host), () => bus);
    expect(() => bus.emit('upload-click', undefined)).not.toThrow();
  });
});
