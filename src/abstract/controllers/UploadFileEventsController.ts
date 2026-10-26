import { EventEmitter } from '../../blocks/UploadCtxProvider/EventEmitter';
import { inject } from '../di/inject';
import { UploaderEventType } from '../EventBus';
import { toOutputFileEntry } from '../outputFileEntry';
import { TypedData } from '../TypedData';
import type { Uid } from '../Uid';
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
  @inject(EventEmitter) private readonly _eventEmitter!: EventEmitter;

  // Rest-forwarded so the 2-/3-arg call arity reaches `EventEmitter.emit` unchanged.
  private _emit = (...args: Parameters<EventEmitter['emit']>): void => {
    this._eventEmitter.emit(...args);
  };

  /** `FILE_ADDED` for a newly added entry (unless it was added silently). */
  public added(entry: Entry): void {
    if (!entry.get('silent')) {
      this._emit(UploaderEventType.FILE_ADDED, toOutputFileEntry(entry));
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
    if (thumbUrl) {
      URL.revokeObjectURL(thumbUrl);
    }
    this._emit(UploaderEventType.FILE_REMOVED, toOutputFileEntry(entry));
  }

  /** `FILE_UPLOAD_PROGRESS` for each entry that is actively (non-silently) uploading. */
  public progress(ids: Iterable<Uid>): void {
    this._emitEach(ids, UploaderEventType.FILE_UPLOAD_PROGRESS, ({ isUploading, silent }) => isUploading && !silent);
  }

  /**
   * `FILE_UPLOAD_START` for an entry whose upload starts now (unless it was added silently). Called by
   * `UploadController` where the upload starts rather than from the collection observer: its changes arrive batched,
   * and an upload that finishes inside one batch would never be seen uploading.
   */
  public start(entry: Entry): void {
    if (!entry.get('silent')) {
      this._emit(UploaderEventType.FILE_UPLOAD_START, toOutputFileEntry(entry));
    }
  }

  /** `FILE_UPLOAD_SUCCESS` for each entry that just got `fileInfo` (non-silently). */
  public success(ids: Iterable<Uid>): void {
    this._emitEach(ids, UploaderEventType.FILE_UPLOAD_SUCCESS, ({ fileInfo, silent }) => !!fileInfo && !silent);
  }

  /** `FILE_UPLOAD_FAILED` for `id` if it has errors. Returns whether it emitted (the caller pairs a common-failed emit). */
  public failed(id: Uid): boolean {
    const entry = TypedData.getByUid<UploadEntryData>(id);
    if (!entry || entry.values.errors.length === 0) {
      return false;
    }
    this._emit(UploaderEventType.FILE_UPLOAD_FAILED, toOutputFileEntry(entry));
    return true;
  }

  /** `FILE_URL_CHANGED` for each id whose `cdnUrl` is now set. */
  public urlChanged(ids: Iterable<Uid>): void {
    this._emitEach(ids, UploaderEventType.FILE_URL_CHANGED, ({ cdnUrl }) => !!cdnUrl);
  }

  /** Emits `type` with each entry that still exists and passes `shouldEmit`. */
  private _emitEach(
    ids: Iterable<Uid>,
    type:
      | typeof UploaderEventType.FILE_UPLOAD_PROGRESS
      | typeof UploaderEventType.FILE_UPLOAD_SUCCESS
      | typeof UploaderEventType.FILE_URL_CHANGED,
    shouldEmit: (values: Readonly<UploadEntryData>) => boolean,
  ): void {
    for (const id of ids) {
      const entry = TypedData.getByUid<UploadEntryData>(id);
      if (entry && shouldEmit(entry.values)) {
        this._emit(type, toOutputFileEntry(entry));
      }
    }
  }
}
