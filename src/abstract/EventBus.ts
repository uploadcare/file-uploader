import type { OutputCollectionState, OutputFileEntry } from '../types/exported';
import type { ActivityType, RegisteredActivityType } from './activity-constants';
import { controllerLogger } from './controllerLogger';
import { lifetimeOf } from './di/ControllerContainer';
import { lazy } from './logger';

/** How long `emitDebounced` waits for the last of a burst of emits of one type. */
export const EMIT_DEBOUNCE_MS = 20;

/**
 * Canonical event surface for the whole library. `EventEmitter`
 * (`src/abstract/EventEmitter.ts`) re-exports these as the
 * documented `EventType`/`EventPayload`, so the internal and documented names
 * cannot drift apart.
 */
export const UploaderEventType = Object.freeze({
  FILE_ADDED: 'file-added',
  FILE_REMOVED: 'file-removed',
  FILE_UPLOAD_START: 'file-upload-start',
  FILE_UPLOAD_PROGRESS: 'file-upload-progress',
  FILE_UPLOAD_SUCCESS: 'file-upload-success',
  FILE_UPLOAD_FAILED: 'file-upload-failed',
  FILE_URL_CHANGED: 'file-url-changed',

  MODAL_OPEN: 'modal-open',
  MODAL_CLOSE: 'modal-close',
  DONE_CLICK: 'done-click',
  UPLOAD_CLICK: 'upload-click',
  ACTIVITY_CHANGE: 'activity-change',

  COMMON_UPLOAD_START: 'common-upload-start',
  COMMON_UPLOAD_PROGRESS: 'common-upload-progress',
  COMMON_UPLOAD_SUCCESS: 'common-upload-success',
  COMMON_UPLOAD_FAILED: 'common-upload-failed',

  CHANGE: 'change',
  GROUP_CREATED: 'group-created',
} as const);

export type UploaderEventKey = (typeof UploaderEventType)[keyof typeof UploaderEventType];

export type { OutputFileEntry, OutputCollectionState };

export type UploaderEventPayload = {
  'file-added': OutputFileEntry<'idle'>;
  'file-removed': OutputFileEntry<'removed'>;
  'file-upload-start': OutputFileEntry<'uploading'>;
  'file-upload-progress': OutputFileEntry<'uploading'>;
  'file-upload-success': OutputFileEntry<'success'>;
  'file-upload-failed': OutputFileEntry<'failed'>;
  'file-url-changed': OutputFileEntry<'success'>;

  // `modalId` is always a concrete activity id — the router only emits these on
  // open→close transitions with a real id, never `null`.
  'modal-open': { modalId: RegisteredActivityType };
  'modal-close': { modalId: RegisteredActivityType; hasActiveModals: boolean };
  'activity-change': { activity: ActivityType };

  'upload-click': undefined;
  'done-click': OutputCollectionState;

  'common-upload-start': OutputCollectionState<'uploading'>;
  'common-upload-progress': OutputCollectionState<'uploading'>;
  'common-upload-success': OutputCollectionState<'success'>;
  'common-upload-failed': OutputCollectionState<'failed'>;

  change: OutputCollectionState;
  'group-created': OutputCollectionState<'success', 'has-group'>;
};

/**
 * Pure pub/sub. No DOM, no CustomEvent — `<uc-upload-ctx-provider>` bridges
 * this to DOM events.
 */
export class EventBus {
  // Per-ctx logger: `warn`/`error` always print; the verbose tier (event logging)
  // is gated by THIS ctx's `debug` config. ctx-name + gate resolve lazily at log
  // time via the container that built this instance.
  private readonly _log = controllerLogger(this, 'event-bus');
  private _listeners = new Map<string, Set<(payload: unknown) => void>>();
  private _debounceTimers = new Map<string, number>();

  public on<K extends UploaderEventKey>(type: K, handler: (payload: UploaderEventPayload[K]) => void): () => void {
    let set = this._listeners.get(type);
    if (!set) {
      set = new Set();
      this._listeners.set(type, set);
    }
    set.add(handler as (payload: unknown) => void);
    return () => {
      set.delete(handler as (payload: unknown) => void);
      // Drop the empty Set so unused event keys don't linger. The key space
      // is a fixed enum so this is bounded either way, but it keeps the map
      // tidy and consistent with `UploaderRegistry`.
      if (set.size === 0) this._listeners.delete(type);
    };
  }

  /**
   * Fire to every listener for `type`. Each handler runs in its own
   * try/catch — a single throwing listener must not cancel the emit loop or
   * bubble back to the code that triggered the event.
   *
   * Every event — the host's DOM events, `api.on` handlers, telemetry — leaves
   * the uploader through here, so this is where an event raised once the ctx is
   * torn down (by a controller's teardown or late async work) is dropped.
   */
  public emit<K extends UploaderEventKey>(type: K, payload: UploaderEventPayload[K]): void {
    if (lifetimeOf(this).signal.aborted) return;
    // Central event logging (verbose/debug-gated) — one readable line per event,
    // moved here from the DOM event bridge so every emit is logged at the source.
    // `→ <type>` marks a dispatch (the `event-bus` scope already says it's an
    // event). Thunked + shallow-copied so the snapshot is only built when on.
    this._log.debug(lazy(() => [`→ ${type}`, payload && typeof payload === 'object' ? { ...payload } : payload]));
    const set = this._listeners.get(type);
    if (!set) return;
    for (const handler of set) {
      try {
        handler(payload);
      } catch (err) {
        this._log.warn(`listener for "${type}" threw`, err);
      }
    }
  }

  /**
   * Debounced emit ({@link EMIT_DEBOUNCE_MS} window). `payload` is a thunk so a heavy
   * `buildOutputCollectionState` is only built once per debounce window.
   */
  public emitDebounced<K extends UploaderEventKey>(type: K, payload: () => UploaderEventPayload[K]): void {
    const existing = this._debounceTimers.get(type);
    if (existing) window.clearTimeout(existing);
    const timeoutId = window.setTimeout(() => {
      this._debounceTimers.delete(type);
      try {
        this.emit(type, payload());
      } catch (err) {
        this._log.warn(`payload thunk for "${type}" threw`, err);
      }
    }, EMIT_DEBOUNCE_MS);
    this._debounceTimers.set(type, timeoutId);
  }

  /** Catch-all subscription — receives every emitted event with its type. */
  public onAny(handler: (type: string, payload: unknown) => void): () => void {
    const wrap = (type: string) => (payload: unknown) => handler(type, payload);
    const unsubs: Array<() => void> = [];
    for (const type of Object.values(UploaderEventType)) {
      unsubs.push(this.on(type as UploaderEventKey, wrap(type) as never));
    }
    return () => {
      for (const u of unsubs) u();
    };
  }

  public destroy(): void {
    for (const id of this._debounceTimers.values()) window.clearTimeout(id);
    this._debounceTimers.clear();
    this._listeners.clear();
  }
}
