import { inject } from '../../abstract/di/inject';
import { EventBus, type UploaderEventKey, type UploaderEventPayload, UploaderEventType } from '../../abstract/EventBus';

const DEFAULT_DEBOUNCE_TIMEOUT = 20;

export const InternalEventType = Object.freeze({
  INIT_SOLUTION: 'init-solution',
  CHANGE_CONFIG: 'change-config',
  ACTION_EVENT: 'action-event',
  ERROR_EVENT: 'error-event',
} as const);

export type InternalEventKey = (typeof InternalEventType)[keyof typeof InternalEventType];

/**
 * The documented event surface lives in `EventBus`
 * (`UploaderEventType`/`UploaderEventPayload`) — the single source of truth. It
 * is re-exported here under the public `EventType`/`EventPayload`/`EventKey`
 * names so the documented contract and the bus the facade delegates to cannot
 * drift apart.
 */
export { UploaderEventType as EventType };
export type { UploaderEventKey as EventKey, UploaderEventPayload as EventPayload };

/**
 * Facade over the per-ctx DOM-free `EventBus`.
 *
 * `on`/`emit` delegate to the bus; the DOM `CustomEvent` dispatch lives in the
 * `@subscription() _bridgeBusToDom` on `<uc-upload-ctx-provider>`. The public
 * surface (event types, debounce, payload thunks, `api.on`) is unchanged — only
 * the storage/dispatch moved behind the bus.
 *
 * Container-resolved with a zero-arg ctor, `@inject`-ing the per-ctx
 * `EventBus`; `container.get(EventEmitter)` yields the single per-ctx
 * instance. This facade stays PURE dispatch — no telemetry. `destroy()` is a
 * no-op — the facade itself holds no subscriptions to unwind; it exists so
 * the container can treat all its owned managers uniformly.
 */
export class EventEmitter {
  @inject(EventBus) private readonly _bus!: EventBus;

  public on<T extends UploaderEventKey>(type: T, handler: (payload: UploaderEventPayload[T]) => void): () => void {
    return this._bus.on(type, handler);
  }

  public emit<T extends UploaderEventKey>(
    type: T,
    payload?: UploaderEventPayload[T] | (() => UploaderEventPayload[T]),
    options: { debounce?: boolean | number } = {},
  ): void {
    const { debounce } = options;
    // A value or a thunk is accepted on either path (the runtime resolves
    // both); the single `as` bridges the optional `payload?` to the required
    // payload for events whose payload isn't `undefined`.
    const resolve = () => (typeof payload === 'function' ? payload() : payload) as UploaderEventPayload[T];
    if (typeof debounce !== 'number' && !debounce) {
      this._bus.emit(type, resolve());
      return;
    }
    const timeout = typeof debounce === 'number' ? debounce : DEFAULT_DEBOUNCE_TIMEOUT;
    this._bus.emitDebounced(type, resolve, timeout);
  }

  public destroy(): void {
    // No-op: the facade holds no subscriptions of its own.
  }
}
