import type { UploadcareGroup } from '@uploadcare/upload-client';
import type { Uid } from '../../lit/Uid';
import type { OutputCollectionState, OutputErrorCollection } from '../../types';
import { SignalMap } from '../di/SignalMap';

/**
 * The six derived UI-state keys the upload stack publishes and the blocks read
 * every render — `*uploadList`, `*commonProgress`, `*collectionState`,
 * `*collectionErrors`, `*groupInfo`, `*uploadTrigger`. In v1 these were orphan
 * `*`-keys in the per-ctx nanostores map with no controller owner; this is
 * their signal-backed owner, routed through `PubSubCompat` so the existing
 * writers (the 9 `stateBridges`, `UploaderPublicApi.uploadAll`) and readers
 * (`UploadList`, `ProgressBarCommon`, `DynamicBtn`, `buildOutputCollectionState`)
 * keep working unchanged.
 */
export type CollectionState = {
  uploadList: { uid: Uid }[];
  commonProgress: number;
  collectionState: OutputCollectionState | null;
  collectionErrors: OutputErrorCollection[];
  groupInfo: UploadcareGroup | null;
  uploadTrigger: Set<Uid>;
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
 * `subscribe()` is a COARSE notify (any-key granularity) — `PubSubCompat`'s
 * `_subDerived` restores per-key granularity with an `Object.is` guard, so a
 * `commonProgress` write never fires an `uploadList` subscriber.
 *
 * The initial values are built fresh per instance (in the field initializer, run
 * once per construction) so the mutable seeds — the `uploadList`/`collectionErrors`
 * arrays and the live `uploadTrigger` `Set` — are never shared across ctxs.
 */
export class CollectionStateController {
  #state = new SignalMap<CollectionState>({
    uploadList: [],
    commonProgress: 0,
    collectionState: null,
    collectionErrors: [],
    groupInfo: null,
    uploadTrigger: new Set<Uid>(),
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
   * bag read (kept for the still-imperative `PubSubCompat` compat path, whose
   * per-read signal overhead on this hot path measurably destabilizes the
   * parallel e2e suite — see `SignalMap`/`CollectionState` docs); both coexist
   * only during the strangler migration.
   */
  public getTracked<K extends keyof CollectionState>(key: K): CollectionState[K] {
    return this.#state.signal(key).get() as CollectionState[K];
  }

  /** `Object.is` dedup — replacing the `uploadTrigger` `Set` fires; mutating it in place does not (v1 parity). */
  public set<K extends keyof CollectionState>(key: K, value: CollectionState[K]): void {
    this.#state.set(key, value);
  }

  /** Coarse subscribe — fires on any collection-state change, not per-key. */
  public subscribe(listener: () => void): () => void {
    return this.#state.subscribe(listener);
  }

  public destroy(): void {
    this.#state.destroy();
  }
}
