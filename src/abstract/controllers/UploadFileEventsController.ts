import { EventEmitter } from '../../blocks/UploadCtxProvider/EventEmitter';
import type { Uid } from '../../lit/Uid';
import { inject, injectOrNull } from '../di/inject';
import { UploaderEventType } from '../EventBus';
import { TypedData } from '../TypedData';
import { UploaderPublicApi } from '../UploaderPublicApi';
import type { UploadEntryData } from '../uploadEntrySchema';

type Entry = TypedData<UploadEntryData>;

/**
 * Per-FILE event emission — the file-scoped half of the collection→events
 * derivation, split out of {@link UploadEventsController}. Pure event dispatch +
 * per-entry finalization; it owns no observers or lifecycle. The coordinator
 * calls these in the exact order the single collection observer dictates, so the
 * documented event ordering is unchanged.
 */
export class UploadFileEventsController {
  @injectOrNull(EventEmitter) private readonly _eventEmitter!: EventEmitter | null;
  @inject(UploaderPublicApi) private readonly _api!: UploaderPublicApi;

  // Guarded dispatch — matches the coordinator's `_emit` (a released container
  // resolves `null` → no-op). Rest-forwarded so the 2-/3-arg call arity reaches
  // `EventEmitter.emit` unchanged.
  private _emit = (...args: Parameters<EventEmitter['emit']>): void => {
    this._eventEmitter?.emit(...args);
  };

  /** `FILE_ADDED` for a newly added entry (unless it was added silently). */
  public added(entry: Entry): void {
    if (!entry.get('silent')) {
      this._emit(UploaderEventType.FILE_ADDED, this._api.getOutputItem(entry.uid));
    }
  }

  /** Finalize a removed entry's state (abort already done by the collection) and emit `FILE_REMOVED`. */
  public finalizeRemoved(entry: Entry): void {
    entry.setMany({
      isRemoved: true,
      abortController: null,
      isUploading: false,
      uploadProgress: 0,
    });
    const thumbUrl = entry.get('thumbUrl');
    thumbUrl && URL.revokeObjectURL(thumbUrl);
    this._emit(UploaderEventType.FILE_REMOVED, this._api.getOutputItem(entry.uid));
  }

  /** `FILE_UPLOAD_PROGRESS` for each entry that is actively (non-silently) uploading. */
  public progress(ids: Iterable<Uid>): void {
    for (const id of ids) {
      const entry = TypedData.getByUid<UploadEntryData>(id);
      if (!entry) continue;
      const { isUploading, silent } = entry.values;
      if (isUploading && !silent) {
        this._emit(UploaderEventType.FILE_UPLOAD_PROGRESS, this._api.getOutputItem(id));
      }
    }
  }

  /** `FILE_UPLOAD_START` for each entry that just started (non-silently) uploading. */
  public start(ids: Iterable<Uid>): void {
    for (const id of ids) {
      const entry = TypedData.getByUid<UploadEntryData>(id);
      if (!entry) continue;
      const { isUploading, silent } = entry.values;
      if (isUploading && !silent) {
        this._emit(UploaderEventType.FILE_UPLOAD_START, this._api.getOutputItem(id));
      }
    }
  }

  /** `FILE_UPLOAD_SUCCESS` for each entry that just got `fileInfo` (non-silently). */
  public success(ids: Iterable<Uid>): void {
    for (const id of ids) {
      const entry = TypedData.getByUid<UploadEntryData>(id);
      if (!entry) continue;
      const { fileInfo, silent } = entry.values;
      if (fileInfo && !silent) {
        this._emit(UploaderEventType.FILE_UPLOAD_SUCCESS, this._api.getOutputItem(id));
      }
    }
  }

  /** `FILE_UPLOAD_FAILED` for `id` if it has errors. Returns whether it emitted (the caller pairs a common-failed emit). */
  public failed(id: Uid): boolean {
    const entry = TypedData.getByUid<UploadEntryData>(id);
    if (!entry || entry.values.errors.length === 0) {
      return false;
    }
    this._emit(UploaderEventType.FILE_UPLOAD_FAILED, this._api.getOutputItem(id));
    return true;
  }

  /** `FILE_URL_CHANGED` for each id whose `cdnUrl` is now set. */
  public urlChanged(ids: Iterable<Uid>): void {
    for (const id of ids) {
      const entry = TypedData.getByUid<UploadEntryData>(id);
      if (!entry?.values.cdnUrl) continue;
      this._emit(UploaderEventType.FILE_URL_CHANGED, this._api.getOutputItem(id));
    }
  }
}
