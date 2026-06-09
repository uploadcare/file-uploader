import {
  type EventBus,
  type UploaderEventKey,
  type UploaderEventPayload,
  UploaderEventType,
} from '../../abstract/EventBus';
import { SharedInstance } from '../../lit/shared-instances';

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
 * Facade over the per-ctx DOM-free `EventBus` (`UploaderController.events`).
 *
 * `on`/`emit` delegate to the bus; the DOM `CustomEvent` dispatch lives in the
 * reactive `EventBridgeController` attached to `<uc-upload-ctx-provider>`. The
 * public surface (event types, debounce, payload thunks, `api.on`) is
 * unchanged — only the storage/dispatch moved behind the bus.
 */
export class EventEmitter extends SharedInstance {
  private get _bus(): EventBus {
    return this._ctx.uploaderController().events;
  }

  public on<T extends UploaderEventKey>(type: T, handler: (payload: UploaderEventPayload[T]) => void): () => void {
    return this._bus.on(type, handler);
  }

  public emit<T extends UploaderEventKey, TDebounce extends boolean | number | undefined = undefined>(
    type: T,
    payload?: TDebounce extends false | undefined ? UploaderEventPayload[T] : () => UploaderEventPayload[T],
    options: { debounce?: TDebounce } = {},
  ): void {
    const { debounce } = options;
    // The public API permits omitting `payload`, but callers always provide one
    // for events whose payload isn't `undefined`; assert presence at this single
    // boundary (mirrors v1's `payload as EventPayload[T]`).
    const resolve = () => (typeof payload === 'function' ? payload() : payload) as UploaderEventPayload[T];
    if (typeof debounce !== 'number' && !debounce) {
      this._bus.emit(type, resolve());
      return;
    }
    const timeout = typeof debounce === 'number' ? debounce : DEFAULT_DEBOUNCE_TIMEOUT;
    this._bus.emitDebounced(type, resolve, timeout);
  }
}
