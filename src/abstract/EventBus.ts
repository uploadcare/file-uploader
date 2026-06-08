import type { UploadcareGroup } from '@uploadcare/upload-client';
import type { OutputCollectionState, OutputFileEntry } from '../types/exported';

/**
 * v2 event surface. Mirrors v1's `EventType` from
 * `src/blocks/UploadCtxProvider/EventEmitter.ts` so consumers can swap
 * v1 → v2 without touching their event handlers.
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

/**
 * v2 reuses v1's `OutputFileEntry` shape for parity. Re-exported under
 * the legacy `FileOutput` alias too — old v2 callers keep working.
 */
export type { OutputFileEntry, OutputCollectionState };
export type FileOutput = OutputFileEntry;

export type UploaderEventPayload = {
  'file-added': OutputFileEntry<'idle'>;
  'file-removed': OutputFileEntry<'removed'>;
  'file-upload-start': OutputFileEntry<'uploading'>;
  'file-upload-progress': OutputFileEntry<'uploading'>;
  'file-upload-success': OutputFileEntry<'success'>;
  'file-upload-failed': OutputFileEntry<'failed'>;
  'file-url-changed': OutputFileEntry<'success'>;

  /**
   * `modalId` is the v1 name for the modal/activity. `activity` is the v2
   * name. Both fields carry the same value; consumers may use either.
   */
  'modal-open': { activity: string; modalId: string };
  /**
   * `modalId` is the v1 name; `activity` is the v2 equivalent (both null
   * after a close). `hasActiveModals` is v1-compat — always `false` in v2
   * since the router has a single foreground slot that just closed.
   */
  'modal-close': {
    activity: string | null;
    modalId: string | null;
    hasActiveModals: boolean;
  };
  'activity-change': { activity: string | null };

  'upload-click': undefined;
  'done-click': OutputCollectionState;

  'common-upload-start': OutputCollectionState<'uploading'>;
  'common-upload-progress': OutputCollectionState<'uploading'>;
  'common-upload-success': OutputCollectionState<'success'>;
  'common-upload-failed': OutputCollectionState<'failed'>;

  change: OutputCollectionState;
  'group-created': OutputCollectionState<'success', 'has-group'> & { groupInfo: UploadcareGroup };
};

/**
 * Pure pub/sub. No DOM, no CustomEvent — the UI layer
 * (`bindEventBusToElement` in `ui-adapters.ts`) bridges this to DOM events
 * on an element if desired.
 */
export class EventBus {
  private _listeners = new Map<string, Set<(payload: unknown) => void>>();
  private _debounceTimers = new Map<string, number>();
  private static readonly DEFAULT_DEBOUNCE_MS = 20;

  public on<K extends UploaderEventKey>(type: K, handler: (payload: UploaderEventPayload[K]) => void): () => void {
    let set = this._listeners.get(type);
    if (!set) {
      set = new Set();
      this._listeners.set(type, set);
    }
    set.add(handler as (payload: unknown) => void);
    return () => set.delete(handler as (payload: unknown) => void);
  }

  /**
   * Fire to every listener for `type`. Each handler runs in its own
   * try/catch — a single throwing listener must not cancel the emit
   * loop or bubble back to the code that triggered the event (this used
   * to surface as spurious `UPLOAD_ERROR`s when a plugin's
   * `file-upload-success` listener threw).
   */
  public emit<K extends UploaderEventKey>(type: K, payload: UploaderEventPayload[K]): void {
    const set = this._listeners.get(type);
    if (!set) return;
    for (const handler of set) {
      try {
        handler(payload);
      } catch (err) {
        console.warn(`[v2/events] listener for "${type}" threw`, err);
      }
    }
  }

  /**
   * Debounced emit. `payload` is a thunk so the heavy
   * `buildOutputCollectionState` is only built once per debounce window.
   * Mirrors v1's `EventEmitter.emit(type, fn, { debounce })`.
   */
  public emitDebounced<K extends UploaderEventKey>(
    type: K,
    payload: () => UploaderEventPayload[K],
    ms: number = EventBus.DEFAULT_DEBOUNCE_MS,
  ): void {
    const existing = this._debounceTimers.get(type);
    if (existing) window.clearTimeout(existing);
    const timeoutId = window.setTimeout(() => {
      this._debounceTimers.delete(type);
      try {
        this.emit(type, payload());
      } catch (err) {
        console.warn(`[v2/events] payload thunk for "${type}" threw`, err);
      }
    }, ms);
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
