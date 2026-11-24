import type { UploadcareGroup } from '@uploadcare/upload-client';
import type { OutputCollectionState, OutputErrorCollection } from '../../types';
import { type ObserveOptions, SignalMap } from '../di/SignalMap';
import type { Uid } from '../Uid';

/**
 * The derived UI-state keys the upload stack publishes and the blocks read
 * every render — `uploadList`, `commonProgress`, `collectionState`,
 * `collectionErrors`, `groupInfo`, `groupError`, signal-backed.
 */
export type CollectionState = {
  uploadList: Uid[];
  commonProgress: number;
  collectionState: OutputCollectionState | null;
  collectionErrors: OutputErrorCollection[];
  groupInfo: UploadcareGroup | null;
  groupError: Error | null;
};

/**
 * Owns the derived collection state as a composed `SignalMap` (has-a, exactly
 * like `ConfigController`/`LocaleController`). Zero-arg ctor, container-resolved.
 *
 * `SignalMap` (not per-field `@signalState`) is deliberate: `get` reads the
 * fast null-proto bag directly, so imperative hot reads never route through
 * `Signal.State.get()`; `getTracked` reads the write-maintained per-key signal.
 *
 * The initial values are built fresh per instance (in the field initializer, run
 * once per construction) so the mutable seeds — the `uploadList`/`collectionErrors`
 * arrays — are never shared across ctxs.
 */
export class CollectionStateController {
  #state = new SignalMap<CollectionState>({
    uploadList: [],
    commonProgress: 0,
    collectionState: null,
    collectionErrors: [],
    groupInfo: null,
    groupError: null,
  });

  /** Every key is seeded at construction, so the value is always present. */
  public get<K extends keyof CollectionState>(key: K): CollectionState[K] {
    return this.#state.get(key) as CollectionState[K];
  }

  /**
   * Reactive, auto-tracking read of a collection-state key — the `SignalWatcher`
   * counterpart to `get()`. Reading it inside a migrated `ChildBlock`'s update
   * cycle (e.g. `ProgressBarCommon`/`DynamicBtn` reading `commonProgress` in
   * `render()`) subscribes that render to THIS key, so a later `set()`
   * re-renders the block.
   *
   * Mirrors `ConfigController.getTracked`: `get()` stays the fast, non-tracking
   * bag read for imperative readers.
   */
  public getTracked<K extends keyof CollectionState>(key: K): CollectionState[K] {
    return this.#state.getTracked(key) as CollectionState[K];
  }

  /** `Object.is` dedup — a replaced reference fires; mutating a held value in place does not (v1 parity). */
  public set<K extends keyof CollectionState>(key: K, value: CollectionState[K]): void {
    this.#state.set(key, value);
  }

  /**
   * Atomic per-key subscription: fires only when THIS key changes (`Object.is`
   * dedup — a replaced `Set`/object fires, an in-place mutation does not), not on
   * every collection-state write. Pass `{ immediate: true }` to also fire once
   * with the current value on subscribe. Mirrors `ConfigController.observe`.
   */
  public observe<K extends keyof CollectionState>(
    key: K,
    listener: (value: CollectionState[K]) => void,
    options?: ObserveOptions,
  ): () => void {
    return this.#state.observe(key, listener as (value: CollectionState[K] | undefined) => void, options);
  }

  public destroy(): void {
    this.#state.destroy();
  }
}
