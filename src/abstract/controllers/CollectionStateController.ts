import type { UploadcareGroup } from '@uploadcare/upload-client';
import type { Uid } from '../../lit/Uid';
import type { OutputCollectionState, OutputErrorCollection } from '../../types';
import type { ReactiveStore } from '../di/ReactiveStore';
import { type ObserveOptions, SignalMap } from '../di/SignalMap';

/**
 * The derived UI-state keys the upload stack publishes and the blocks read
 * every render — `*uploadList`, `*commonProgress`, `*collectionState`,
 * `*collectionErrors`, `*groupInfo`. In v1 these were orphan `*`-keys in the
 * per-ctx store map with no controller owner; this is their signal-backed owner.
 * (The former `*uploadTrigger` key is gone — `uploadAll` now uploads through
 * `UploadController.uploadEntries` directly, not a broadcast state key.)
 */
export type CollectionState = {
  uploadList: { uid: Uid }[];
  commonProgress: number;
  collectionState: OutputCollectionState | null;
  collectionErrors: OutputErrorCollection[];
  groupInfo: UploadcareGroup | null;
};

/**
 * Owns the derived collection state as a composed `SignalMap` (has-a, exactly
 * like `ConfigController`/`LocaleController`). Zero-arg ctor, container-resolved.
 *
 * `SignalMap` (not per-field `@signalState`) is deliberate: `get` reads the
 * fast null-proto bag directly, so the compat read path (`api.cfg`-style hot
 * reads — `uploadList`/`commonProgress` are read on every render) never routes
 * through `Signal.State.get()`. Step 3a proved that per-read signal overhead on
 * a hot path measurably destabilizes the parallel e2e suite. The per-key
 * signals stay write-maintained for the future `SignalWatcher` consumer (step 6).
 *
 * `subscribe()` is a COARSE notify (any-key granularity) — the v1 ctx facade's
 * `_subDerived` restores per-key granularity with an `Object.is` guard, so a
 * `commonProgress` write never fires an `uploadList` subscriber.
 *
 * The initial values are built fresh per instance (in the field initializer, run
 * once per construction) so the mutable seeds — the `uploadList`/`collectionErrors`
 * arrays — are never shared across ctxs.
 */
export class CollectionStateController implements ReactiveStore<CollectionState> {
  #state = new SignalMap<CollectionState>({
    uploadList: [],
    commonProgress: 0,
    collectionState: null,
    collectionErrors: [],
    groupInfo: null,
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
   * re-renders the block with no `ctx.sub('*commonProgress', …)` subscription.
   *
   * Mirrors `ConfigController.getTracked`: `get()` stays the fast, non-tracking
   * bag read (kept for the still-imperative the v1 ctx facade compat path, whose
   * per-read signal overhead on this hot path measurably destabilizes the
   * parallel e2e suite — see `SignalMap`/`CollectionState` docs); both coexist
   * only during the strangler migration.
   */
  public getTracked<K extends keyof CollectionState>(key: K): CollectionState[K] {
    return this.#state.signal(key).get() as CollectionState[K];
  }

  /** `Object.is` dedup — a replaced reference fires; mutating a held value in place does not (v1 parity). */
  public set<K extends keyof CollectionState>(key: K, value: CollectionState[K]): void {
    this.#state.set(key, value);
  }

  /** Batch set collection-state keys — one coalesced notify. */
  public setMany(patch: Partial<CollectionState>): void {
    this.#state.setMany(patch);
  }

  public notify(): void {
    this.#state.notify();
  }

  /** The live value bag (a stable reference, mutated in place on write). */
  public get values(): Readonly<CollectionState> {
    return this.#state.values;
  }

  /** Coarse subscribe — fires on any collection-state change, not per-key. */
  public subscribe(listener: () => void): () => void {
    return this.#state.subscribe(listener);
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
