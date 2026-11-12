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
import { ConfigController } from './ConfigController';
import { UploadCollectionController } from './UploadCollectionController';
import { UploadController } from './UploadController';

type Entry = TypedData<UploadEntryData>;

/** Prefixes a collection error type among the failure keys, which are otherwise file uids. */
const COLLECTION_ERROR_KEY = 'collection:';

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
  @inject(ConfigController) private readonly _config!: ConfigController;
  @inject(CollectionStateController) private readonly _collectionState!: CollectionStateController;
  @inject(UploadCollectionController) private readonly _collection!: UploadCollectionController;
  // A thunk: `UploadController` reaches this module back through `ValidationController`.
  @inject(() => UploadController) private readonly _upload!: UploadController;

  /**
   * The CDN URLs `COMMON_UPLOAD_SUCCESS` last reported, or `null` when it has not fired for the collection as it is.
   * Every file is validated again once uploaded, and validations that land in separate batches would each see the whole
   * collection done and report it again. An edit in the editor changes a URL, so the edited collection is reported again,
   * as in v1.
   */
  private _reportedSuccessUrls: string | null = null;

  /**
   * What `COMMON_UPLOAD_FAILED` last reported as failing: the failed files' uids and the collection error types, the
   * latter prefixed with {@link COLLECTION_ERROR_KEY}.
   */
  private _reportedFailures = new Set<string>();

  /**
   * Membership changed → the current group no longer describes the collection, and its success is not reported yet.
   * Nor are its collection errors: they judge the files as a whole, so one reported for the old files (the empty list
   * at mount) is a new verdict for the new ones.
   */
  public resetGroupIfMembershipChanged(added: Set<Entry>, removed: Set<Entry>): void {
    if (added.size || removed.size) {
      this.resetGroup();
      this._reportedSuccessUrls = null;
      this._forgetReportedCollectionErrors();
    }
  }

  /**
   * An upload batch started (`uploadAll()`): a collection error still standing once it settles is a verdict on that
   * batch, so it is reported again, as in v1. Reported file failures stay reported.
   */
  public startBatch(): void {
    this._forgetReportedCollectionErrors();
  }

  private _forgetReportedCollectionErrors(): void {
    this._reportedFailures = new Set(
      [...this._reportedFailures].filter((key) => !key.startsWith(COLLECTION_ERROR_KEY)),
    );
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
    const collectionState = buildOutputCollectionState(requireContainerOf(this), { warnOnLateRead: false });
    this._collectionState.set('collectionState', collectionState);
    this._eventEmitter.emit(UploaderEventType.CHANGE, () => this._outputCollectionState(), { debounce: true });
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
    this._eventEmitter.emit(UploaderEventType.COMMON_UPLOAD_PROGRESS, this._outputCollectionState());
  }

  /**
   * `COMMON_UPLOAD_FAILED` once the collection is failed (a file or collection error) and every file not yet uploaded
   * or failed is settled too: none is uploading, validating, or about to start uploading on its own. Once per failure:
   * it reports again only when something fails that the last report did not include, or a collection error still
   * stands once a new upload batch ({@link startBatch}) settles. Validating an uploaded or failed file again (after its
   * upload, or on a config change) does not reopen the batch.
   */
  public emitCommonFailedIfSettled(): void {
    const { confirmUpload, multiple, multipleMax } = this._config.values;
    const max = multiple ? multipleMax : 1;
    // Mirrors the checks before an upload starts: without `confirmUpload` a ready file starts on the upload list's next
    // throttled tick, after its validation has landed, so until then it is still in flight.
    const isStartPending = !confirmUpload && !(max && this._collection.size > max);
    const failures = new Set<string>(
      this._collectionState
        .get('collectionErrors')
        .map((error) => COLLECTION_ERROR_KEY + (error.type ?? 'CUSTOM_ERROR')),
    );
    let isInFlight = false;
    for (const entry of this._collection.entries()) {
      const isFailed = entry.get('errors').length > 0;
      if (isFailed) {
        failures.add(entry.uid);
      }
      if (entry.get('isUploading') || entry.get('isQueuedForUploading')) {
        isInFlight = true;
      } else if (
        !isFailed &&
        !entry.get('fileInfo') &&
        (isStartPending ||
          !!entry.get('uploadError') ||
          entry.get('isValidationPending') ||
          entry.get('isQueuedForValidation'))
      ) {
        isInFlight = true;
      }
    }
    if (isInFlight) {
      // Forget what stopped failing (a file uploaded again), so it is reported if it fails again.
      this._reportedFailures = new Set([...this._reportedFailures].filter((key) => failures.has(key)));
      return;
    }
    const hasNewFailure = [...failures].some((key) => !this._reportedFailures.has(key));
    this._reportedFailures = failures;
    if (hasNewFailure) {
      this._eventEmitter.emit(
        UploaderEventType.COMMON_UPLOAD_FAILED,
        () => this._outputCollectionState() as OutputCollectionState<'failed'>,
        { debounce: true },
      );
    }
  }

  /**
   * `COMMON_UPLOAD_SUCCESS` when every entry is loaded, none errored, and there are no collection errors — once per
   * change into that state, and once more per edit of a file's CDN URL.
   */
  public emitCommonSuccessIfComplete(): void {
    const collection = this._collection;
    // One pass: "all loaded, none errored".
    let loadedCount = 0;
    let hasErrored = false;
    let urls = '';
    for (const entry of collection.entries()) {
      if (entry.get('errors').length > 0) {
        hasErrored = true;
      }
      if (entry.get('fileInfo')) {
        loadedCount++;
      }
      urls += `${entry.get('cdnUrl')} `;
    }
    const isUploadSuccess =
      collection.size > 0 &&
      !hasErrored &&
      collection.size === loadedCount &&
      this._collectionState.get('collectionErrors').length === 0;
    if (!isUploadSuccess) {
      this._reportedSuccessUrls = null;
    } else if (urls !== this._reportedSuccessUrls) {
      this._reportedSuccessUrls = urls;
      this._eventEmitter.emit(
        UploaderEventType.COMMON_UPLOAD_SUCCESS,
        this._outputCollectionState() as OutputCollectionState<'success'>,
      );
    }
  }
}
