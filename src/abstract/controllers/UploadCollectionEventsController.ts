import { EventEmitter } from '../../blocks/UploadCtxProvider/EventEmitter';
import type { Uid } from '../../lit/Uid';
import type { OutputCollectionState } from '../../types';
import { inject, injectOrNull } from '../di/inject';
import { UploaderEventType } from '../EventBus';
import type { TypedData } from '../TypedData';
import { UploaderPublicApi } from '../UploaderPublicApi';
import type { UploadEntryData } from '../uploadEntrySchema';
import { CollectionStateController } from './CollectionStateController';
import { UploadCollectionController } from './UploadCollectionController';
import { UploadController } from './UploadController';

type Entry = TypedData<UploadEntryData>;

/**
 * COLLECTION-level derived state + events — the collection-scoped half of the
 * derivation split out of {@link UploadEventsController}: it maintains the
 * derived collection keys (`uploadList`/`collectionState`/`commonProgress`/
 * `groupInfo` on {@link CollectionStateController}) and emits the collection-wide
 * events (`CHANGE`, `COMMON_UPLOAD_PROGRESS`/`SUCCESS`/`FAILED`). No observers or
 * lifecycle — the coordinator drives it in order; group creation is delegated to
 * `UploadGroupController`.
 */
export class UploadCollectionEventsController {
  @injectOrNull(EventEmitter) private readonly _eventEmitter!: EventEmitter | null;
  @inject(UploaderPublicApi) private readonly _api!: UploaderPublicApi;
  @inject(CollectionStateController) private readonly _collectionState!: CollectionStateController;
  @inject(UploadCollectionController) private readonly _collection!: UploadCollectionController;
  @inject(UploadController) private readonly _upload!: UploadController;

  private _emit = (...args: Parameters<EventEmitter['emit']>): void => {
    this._eventEmitter?.emit(...args);
  };

  /**
   * `COMMON_UPLOAD_SUCCESS` is emitted from the `errors` change flush, which can run
   * more than once while the collection stays complete — latch it so a completion
   * reports exactly once. Cleared when the collection stops being complete or its
   * membership changes.
   */
  private _commonSuccessEmitted = false;

  /** Membership changed → the current group no longer describes the collection. */
  public resetGroupIfMembershipChanged(added: Set<Entry>, removed: Set<Entry>): void {
    if (added.size || removed.size) {
      this._collectionState.set('groupInfo', null);
      this._commonSuccessEmitted = false;
    }
  }

  public resetGroup(): void {
    this._collectionState.set('groupInfo', null);
  }

  public setUploadList(entries: Uid[]): void {
    // Store the bare uid list (a fresh per-flush snapshot from `observeCollection`)
    // — no `{ uid }` wrapper object per entry.
    this._collectionState.set('uploadList', [...entries]);
  }

  /**
   * Rebuild + publish the output collection state and emit the debounced `CHANGE`.
   * Returns the freshly built state (for the group-output decision), or `null`
   * when the item set is inconsistent (defensive early-return).
   */
  public flushOutput(): OutputCollectionState | null {
    const collection = this._collection;
    const getOutputCollectionState = this._api.getOutputCollectionState.bind(this._api);
    // Defensive: bail on an inconsistent item set. Compare the uid-list length to
    // `size` directly (no per-item `OutputFileEntry` build).
    if (collection.items().length !== collection.size) {
      return null;
    }
    const collectionState = getOutputCollectionState();
    this._collectionState.set('collectionState', collectionState);
    this._emit(UploaderEventType.CHANGE, () => getOutputCollectionState(), { debounce: true });
    return collectionState;
  }

  public flushCommonProgress(): void {
    const collection = this._collection;
    const getOutputCollectionState = this._api.getOutputCollectionState.bind(this._api);
    let commonProgress = 0;
    const items = this._upload.uploadBatch;
    items.forEach((id) => {
      const uploadProgress = collection.readProp(id, 'uploadProgress');
      if (typeof uploadProgress === 'number') {
        commonProgress += uploadProgress;
      }
    });
    const progress = items.length ? Math.round(commonProgress / items.length) : 0;

    if (this._collectionState.get('commonProgress') === progress) {
      return;
    }

    this._collectionState.set('commonProgress', progress);
    this._emit(
      UploaderEventType.COMMON_UPLOAD_PROGRESS,
      getOutputCollectionState() as OutputCollectionState<'uploading'>,
    );
  }

  /** `COMMON_UPLOAD_FAILED` (debounced) — paired per errored entry by the coordinator. */
  public emitCommonFailed(): void {
    const getOutputCollectionState = this._api.getOutputCollectionState.bind(this._api);
    this._emit(
      UploaderEventType.COMMON_UPLOAD_FAILED,
      () => getOutputCollectionState() as OutputCollectionState<'failed'>,
      { debounce: true },
    );
  }

  /** `COMMON_UPLOAD_SUCCESS` when every entry is loaded, none errored, and there are no collection errors. */
  public emitCommonSuccessIfComplete(): void {
    const collection = this._collection;
    // One pass: "all loaded, none errored".
    let loadedCount = 0;
    let hasErrored = false;
    for (const uid of collection.items()) {
      const entry = collection.read(uid);
      if (!entry) continue;
      if (entry.get('errors').length > 0) {
        hasErrored = true;
      }
      if (entry.get('fileInfo')) {
        loadedCount++;
      }
    }
    const complete =
      collection.size > 0 &&
      !hasErrored &&
      collection.size === loadedCount &&
      this._collectionState.get('collectionErrors').length === 0;
    if (!complete) {
      this._commonSuccessEmitted = false;
      return;
    }
    if (this._commonSuccessEmitted) {
      return;
    }
    this._commonSuccessEmitted = true;
    this._emit(
      UploaderEventType.COMMON_UPLOAD_SUCCESS,
      this._api.getOutputCollectionState() as OutputCollectionState<'success'>,
    );
  }
}
