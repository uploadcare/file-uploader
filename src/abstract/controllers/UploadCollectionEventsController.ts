import type { OutputCollectionState } from '../../types';
import { buildOutputCollectionState } from '../buildOutputCollectionState';
import { requireContainerOf } from '../di/ControllerContainer';
import { inject } from '../di/inject';
import { UploaderEventType } from '../EventBus';
import { EventEmitter } from '../EventEmitter';
import type { TypedData } from '../TypedData';
import type { Uid } from '../Uid';
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
  @inject(EventEmitter) private readonly _eventEmitter!: EventEmitter;
  @inject(CollectionStateController) private readonly _collectionState!: CollectionStateController;
  @inject(UploadCollectionController) private readonly _collection!: UploadCollectionController;
  @inject(UploadController) private readonly _upload!: UploadController;

  /**
   * Whether `COMMON_UPLOAD_SUCCESS` has fired for the collection as it is. Every file is validated again once uploaded,
   * and validations that land in separate batches would each see the whole collection done and report it again.
   */
  private _isUploadSuccessReported = false;

  private _emit = (...args: Parameters<EventEmitter['emit']>): void => {
    this._eventEmitter.emit(...args);
  };

  /** Membership changed → the current group no longer describes the collection, and its success is not reported yet. */
  public resetGroupIfMembershipChanged(added: Set<Entry>, removed: Set<Entry>): void {
    if (added.size || removed.size) {
      this.resetGroup();
      this._isUploadSuccessReported = false;
    }
  }

  public resetGroup(): void {
    this._collectionState.set('groupInfo', null);
    this._collectionState.set('groupError', null);
  }

  public setUploadList(entries: Uid[]): void {
    // Store the bare uid list (a fresh per-flush snapshot from `observeCollection`)
    // — no `{ uid }` wrapper object per entry.
    this._collectionState.set('uploadList', [...entries]);
  }

  private _outputCollectionState = (): OutputCollectionState => buildOutputCollectionState(requireContainerOf(this));

  /**
   * Rebuild + publish the output collection state and emit the debounced `CHANGE`.
   * Returns the freshly built state (for the group-output decision).
   */
  public flushOutput(): OutputCollectionState {
    const collectionState = this._outputCollectionState();
    this._collectionState.set('collectionState', collectionState);
    this._emit(UploaderEventType.CHANGE, () => this._outputCollectionState(), { debounce: true });
    return collectionState;
  }

  public flushCommonProgress(): void {
    const collection = this._collection;
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
      this._outputCollectionState() as OutputCollectionState<'uploading'>,
    );
  }

  /** `COMMON_UPLOAD_FAILED` (debounced) — paired per errored entry by the coordinator. */
  public emitCommonFailed(): void {
    this._emit(
      UploaderEventType.COMMON_UPLOAD_FAILED,
      () => this._outputCollectionState() as OutputCollectionState<'failed'>,
      { debounce: true },
    );
  }

  /**
   * `COMMON_UPLOAD_SUCCESS` when every entry is loaded, none errored, and there are no collection errors — once per
   * change into that state.
   */
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
    const isUploadSuccess =
      collection.size > 0 &&
      !hasErrored &&
      collection.size === loadedCount &&
      this._collectionState.get('collectionErrors').length === 0;
    if (isUploadSuccess && !this._isUploadSuccessReported) {
      this._emit(
        UploaderEventType.COMMON_UPLOAD_SUCCESS,
        this._outputCollectionState() as OutputCollectionState<'success'>,
      );
    }
    this._isUploadSuccessReported = isUploadSuccess;
  }
}
