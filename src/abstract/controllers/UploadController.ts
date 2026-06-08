import {
  CancelError,
  type FileFromOptions,
  Queue,
  UploadcareError,
  type UploadcareGroup,
  uploadFile,
  uploadFileGroup,
} from '@uploadcare/upload-client';
import type { OutputCollectionState } from '../../types/exported';
import { fileIsImage } from '../../utils/fileTypes';
import { customUserAgent } from '../../utils/userAgent';
import { type EventBus, UploaderEventType } from '../EventBus';
import { Listeners } from '../host-subscription';
import { buildOutputCollectionState, getOutputItem } from '../output-collection-state';
import type { UploadCollection } from '../UploadCollection';
import type { UploadEntry } from '../UploadEntry';
import type { ConfigController } from './ConfigController';
import type { SecureUploadsController } from './SecureUploadsController';
import type { BeforeUploadHandler, UploadCollectionController } from './UploadCollectionController';
import type { UploaderController } from './UploaderController';
import type { ValidationController } from './ValidationController';

type Cfg = {
  pubkey?: string;
  baseUrl?: string;
  cdnCname?: string;
  store?: boolean | 'auto';
  userAgentIntegration?: string;
  retryThrottledRequestMaxTimes?: number;
  retryNetworkErrorMaxTimes?: number;
  multipartMinFileSize?: number;
  multipartChunkSize?: number;
  multipartMaxConcurrentRequests?: number;
  maxConcurrentRequests?: number;
  multiple?: boolean;
  multipleMax?: number;
  confirmUpload?: boolean;
  groupOutput?: boolean;
};

/**
 * v2-native upload pipeline.
 *
 * Owns the concurrency queue and the per-entry upload state machine.
 * `run(entry)` enqueues a single entry; `runAll()` enqueues every idle
 * entry. The `@uploadcare/upload-client` `uploadFile` does the heavy
 * lifting; this controller wires it up with `beforeUpload` hooks,
 * progress writes, abort signals, and result mapping back into the
 * entry's fields.
 *
 * Group output (when `config.groupOutput`) runs after the last upload
 * finishes — the result lands on the `group` reactive field and emits
 * `group-created`.
 */
export class UploadController {
  // Upload-client's queue handles concurrency + promise wiring; we just
  // sync its `concurrency` to `config.maxConcurrentRequests`.
  private _queue: Queue;
  private _abortCtrls = new Map<string, AbortController>();
  private _group: UploadcareGroup | null = null;
  private _groupAbort?: AbortController;
  private _groupKey: string | null = null;
  private _listeners = new Listeners();
  private _collection: UploadCollection | null = null;
  private _controller: UploaderController | null = null;
  private _beforeUploadHandlers: () => readonly BeforeUploadHandler[] = () => [];
  private _unsubCollection?: () => void;
  private _unsubConfig?: () => void;
  private _unsubValidation?: () => void;
  private _entrySubs = new Map<string, () => void>();
  // Tracks aggregated lifecycle so we don't re-emit common-upload-start
  // every time a new entry starts; only on the 0 → ≥1 transition.
  private _commonUploadActive = false;
  private _emitChangeScheduled = false;

  public constructor(
    private _events: EventBus,
    private _config: ConfigController,
    _validation: ValidationController,
    private _secureUploads?: SecureUploadsController,
  ) {
    void _validation;
    this._queue = new Queue(this._concurrencyFromConfig());
    this._unsubConfig = this._config.subscribe(() => {
      const next = this._concurrencyFromConfig();
      if (this._queue.concurrency !== next) this._queue.concurrency = next;
    });
  }

  private _concurrencyFromConfig(): number {
    const cfg = this._config.values as Cfg;
    return Math.max(1, cfg.maxConcurrentRequests ?? 5);
  }

  public start(
    collection: UploadCollection,
    collectionController: UploadCollectionController,
    controller: UploaderController,
  ): void {
    if (this._collection) return;
    this._collection = collection;
    this._controller = controller;
    this._beforeUploadHandlers = () => collectionController.beforeUploadHandlers;

    // Reset group whenever the collection changes structurally.
    this._unsubCollection = collection.subscribe((change) => {
      for (const entry of change.removed) this._entrySubs.get(entry.internalId)?.();
      for (const entry of change.added) this._observeEntry(entry);
      if (change.added.length || change.removed.length) {
        this._groupAbort?.abort();
        this._groupKey = null;
        if (this._group) {
          this._group = null;
          this._listeners.notify();
        }
        // Add/remove changes the collection state — emit change event.
        this._scheduleChangeEmit();
        this._refreshCommonLifecycle();
      }
    });
    for (const entry of collection.items) this._observeEntry(entry);
    // CHANGE also fires when validation errors change the collection state.
    this._unsubValidation = controller.validation.subscribe(() => {
      this._scheduleChangeEmit();
      this._refreshCommonLifecycle();
    });
  }

  // ─── Public surface ───────────────────────────────────────────────────

  public subscribe(listener: () => void): () => void {
    return this._listeners.subscribe(listener);
  }

  public get group(): UploadcareGroup | null {
    return this._group;
  }

  public async run(entry: UploadEntry): Promise<void> {
    if (entry.getValue('isQueuedForUploading')) return;
    if (!this._isUploadable(entry)) return;
    // Mark queued so a second call (e.g. UploadList auto-upload) doesn't
    // re-enqueue the same entry and the header can count it as in flight.
    entry.setValue('isQueuedForUploading', true);
    await this._queue.add(() => this._runOne(entry));
  }

  public async runAll(): Promise<void> {
    if (!this._collection) return;
    const idle = this._collection.items.filter((e) => !e.getValue('isQueuedForUploading') && this._isUploadable(e));
    await Promise.all(idle.map((e) => this.run(e)));
  }

  public abort(entry: UploadEntry): void {
    this._abortCtrls.get(entry.internalId)?.abort();
  }

  public abortAll(): void {
    for (const c of this._abortCtrls.values()) c.abort();
  }

  public destroy(): void {
    this._unsubCollection?.();
    this._unsubConfig?.();
    this._unsubValidation?.();
    this._unsubCollection = undefined;
    this._unsubConfig = undefined;
    this._unsubValidation = undefined;
    for (const u of this._entrySubs.values()) u();
    this._entrySubs.clear();
    this.abortAll();
    this._abortCtrls.clear();
    this._listeners.clear();
    this._collection = null;
    this._controller = null;
  }

  // ─── Internals ────────────────────────────────────────────────────────

  /**
   * Precondition for enqueuing or starting an upload. Doesn't check the
   * queued flag — `run()` does that gate. `_runOne` calls this *after*
   * clearing the flag.
   */
  private _isUploadable(entry: UploadEntry): boolean {
    if (entry.getValue('fileInfo')) return false;
    if (entry.getValue('isUploading')) return false;
    if (entry.getValue('errors').length > 0) return false;
    if (entry.getValue('isRemoved')) return false;
    const input = entry.getValue('file') ?? entry.getValue('externalUrl') ?? entry.getValue('uuid');
    return input != null;
  }

  private async _runOne(entry: UploadEntry): Promise<void> {
    // Clear the queued flag *first* so `_isUploadable` won't see stale
    // state, then re-check preconditions in case the entry was removed
    // or already finished between enqueue and dequeue.
    entry.setValue('isQueuedForUploading', false);
    if (!this._isUploadable(entry)) return;
    const cfg = this._config.values as Cfg;

    entry.setMultipleValues({
      isUploading: true,
      errors: [],
      uploadProgress: 0,
    });

    const abort = new AbortController();
    this._abortCtrls.set(entry.internalId, abort);
    entry.setValue('abortController', abort);

    try {
      let file: File | Blob | null = entry.getValue('file');
      // beforeUpload hooks (registered via the public api).
      if (file instanceof File || file instanceof Blob) {
        for (const hook of this._beforeUploadHandlers()) {
          try {
            const result = await hook({ file: file as File, item: getOutputItem(entry) });
            if (result?.file) {
              file = result.file;
              entry.setValue('mimeType', file.type || null);
              entry.setValue('isImage', fileIsImage(file));
              entry.setValue('fileSize', file.size);
              if (file instanceof File) entry.setValue('fileName', file.name);
            }
          } catch (err) {
            console.warn('[v2/upload] beforeUpload hook failed', err);
          }
        }
      }

      const input = file ?? entry.getValue('externalUrl') ?? entry.getValue('uuid');
      if (!input) throw new Error('No file input');
      const options: FileFromOptions = {
        ...(await this._clientOptions(cfg)),
        fileName: entry.getValue('fileName') ?? undefined,
        source: entry.getValue('source') ?? undefined,
        signal: abort.signal,
        onProgress: (p) => {
          if (p.isComputable) entry.setValue('uploadProgress', p.value * 100);
        },
      };

      const fileInfo = await uploadFile(input, options);
      // `fileInfo` must be set LAST: it fires FILE_UPLOAD_SUCCESS, which
      // v1-shape plugins (cropPreset auto-apply) handle by re-writing
      // `cdnUrl` / `cdnUrlModifiers`. `setMultipleValues` notifies between
      // writes, so anything set after `fileInfo` would overwrite the
      // plugin's reentrant writes with the originally-captured values.
      entry.setMultipleValues({
        isUploading: false,
        isQueuedForUploading: false,
        fileName: fileInfo.originalFilename ?? entry.getValue('fileName'),
        fileSize: fileInfo.size,
        isImage: fileInfo.isImage ?? entry.getValue('isImage'),
        mimeType: fileInfo.contentInfo?.mime?.mime ?? fileInfo.mimeType ?? entry.getValue('mimeType'),
        uuid: fileInfo.uuid,
        cdnUrl: entry.getValue('cdnUrl') ?? fileInfo.cdnUrl,
        cdnUrlModifiers: entry.getValue('cdnUrlModifiers') ?? '',
        uploadProgress: 100,
        fileInfo,
      });
      this._maybeCreateGroup();
    } catch (cause) {
      if (cause instanceof CancelError && cause.isCancel) {
        entry.setMultipleValues({ isUploading: false, uploadProgress: 0 });
      } else if (cause instanceof UploadcareError) {
        entry.setMultipleValues({
          isUploading: false,
          uploadProgress: 0,
          uploadError: cause,
          errors: [{ type: 'UPLOAD_ERROR', message: cause.message ?? 'Upload failed' }],
        });
      } else {
        const err = cause instanceof Error ? cause : new Error('Something went wrong', { cause });
        entry.setMultipleValues({
          isUploading: false,
          uploadProgress: 0,
          uploadError: err,
          errors: [{ type: 'UPLOAD_ERROR', message: err.message }],
        });
      }
    } finally {
      this._abortCtrls.delete(entry.internalId);
    }
  }

  private _maybeCreateGroup(): void {
    void this._maybeCreateGroupAsync();
  }

  private async _maybeCreateGroupAsync(): Promise<void> {
    const cfg = this._config.values as Cfg;
    if (!cfg.groupOutput) return;
    if (!this._collection) return;
    const entries = this._collection.items;
    if (entries.length === 0) return;
    if (entries.some((e) => !e.getValue('fileInfo'))) return;

    const uuidList = entries.map((e) => {
      const uuid = e.getValue('uuid');
      const mods = e.getValue('cdnUrlModifiers');
      return mods ? `${uuid}/${mods}` : (uuid ?? '');
    });
    const key = uuidList.join('|');
    // Skip if we've already created (or are mid-creating) a group for
    // this exact list — entry transitions can fire multiple times.
    if (this._groupKey === key) return;
    this._groupAbort?.abort();
    this._groupKey = key;
    const abort = new AbortController();
    this._groupAbort = abort;
    const clientOpts = await this._clientOptions(cfg);
    if (abort.signal.aborted) return;
    uploadFileGroup(uuidList, {
      ...clientOpts,
      signal: abort.signal,
    })
      .then((group) => {
        if (abort.signal.aborted) return;
        this._group = group;
        this._listeners.notify();
        const ctrl = this._controller;
        if (ctrl) {
          const collectionState = buildOutputCollectionState<'success', 'has-group'>(ctrl);
          this._events.emit(UploaderEventType.GROUP_CREATED, {
            ...collectionState,
            groupInfo: group,
          });
          this._scheduleChangeEmit();
        }
      })
      .catch((err) => {
        if (err instanceof CancelError) return;
        if (this._groupKey === key) this._groupKey = null;
        console.warn('[v2/upload] group creation failed', err);
      });
  }

  private _observeEntry(entry: UploadEntry): void {
    if (this._entrySubs.has(entry.internalId)) return;
    const unsubs: Array<() => void> = [
      // Re-run group creation if cdnUrlModifiers change post-upload (e.g.
      // after crop). v1 did the same via `*collectionState` debounce.
      entry.subscribe('cdnUrlModifiers', () => this._maybeCreateGroup()),
      // Drive aggregated lifecycle. Each of these can flip the collection
      // status — debounce inside `_refreshCommonLifecycle` keeps emit
      // counts sane.
      entry.subscribe('isUploading', () => {
        // Lifecycle first so `common-upload-start` is scheduled (and
        // thus dispatched) before the first `common-upload-progress`.
        this._refreshCommonLifecycle();
        this._emitCommonProgress();
        this._scheduleChangeEmit();
      }),
      entry.subscribe('uploadProgress', () => this._emitCommonProgress()),
      entry.subscribe('fileInfo', () => {
        this._refreshCommonLifecycle();
        this._scheduleChangeEmit();
      }),
      entry.subscribe('errors', () => {
        this._refreshCommonLifecycle();
        this._scheduleChangeEmit();
      }),
      entry.subscribe('cdnUrl', () => this._scheduleChangeEmit()),
    ];
    const unsubAll = (): void => {
      for (const u of unsubs) u();
    };
    this._entrySubs.set(entry.internalId, unsubAll);
  }

  // ─── Aggregated lifecycle emissions ───────────────────────────────────

  private _emitCommonProgress(): void {
    const ctrl = this._controller;
    if (!ctrl || !this._collection) return;
    // Only emit while there's at least one entry uploading — matches v1's
    // gating in `_flushCommonUploadProgress`.
    const anyUploading = this._collection.items.some((e) => e.getValue('isUploading'));
    if (!anyUploading) return;
    this._events.emitDebounced(UploaderEventType.COMMON_UPLOAD_PROGRESS, () =>
      buildOutputCollectionState<'uploading'>(ctrl),
    );
  }

  /**
   * Aggregate the collection's status and emit the corresponding
   * `common-upload-*` event when it transitions.
   *
   * - 0 → ≥1 uploading: common-upload-start
   * - all done + no errors: common-upload-success
   * - any error: common-upload-failed
   */
  private _refreshCommonLifecycle(): void {
    const ctrl = this._controller;
    if (!ctrl || !this._collection) return;
    const items = this._collection.items;
    const total = items.length;
    if (total === 0) {
      this._commonUploadActive = false;
      return;
    }

    let succeed = 0;
    let uploading = 0;
    let failed = 0;
    for (const e of items) {
      const errors = e.getValue('errors');
      if (errors.length > 0) failed += 1;
      else if (e.getValue('fileInfo')) succeed += 1;
      else if (e.getValue('isUploading') || e.getValue('isQueuedForUploading')) uploading += 1;
    }
    const collectionErrors = ctrl.validation.collectionErrors.length;

    // Start: just went from 0 uploading to ≥1.
    if (uploading > 0 && !this._commonUploadActive) {
      this._commonUploadActive = true;
      this._events.emitDebounced(UploaderEventType.COMMON_UPLOAD_START, () =>
        buildOutputCollectionState<'uploading'>(ctrl),
      );
    }

    // Failure: any per-file error or aggregate error surfaces.
    if (failed > 0 || collectionErrors > 0) {
      this._events.emitDebounced(UploaderEventType.COMMON_UPLOAD_FAILED, () =>
        buildOutputCollectionState<'failed'>(ctrl),
      );
    }

    // Success: every entry finished, none failed, no collection-level
    // errors. Match v1's gate (counts succeed === total).
    if (succeed === total && failed === 0 && collectionErrors === 0) {
      this._commonUploadActive = false;
      this._events.emitDebounced(UploaderEventType.COMMON_UPLOAD_SUCCESS, () =>
        buildOutputCollectionState<'success'>(ctrl),
      );
    }
  }

  /**
   * Coalesce CHANGE event emissions to once per microtask so a single
   * tick of many entry-field writes doesn't spray hundreds of events.
   */
  private _scheduleChangeEmit(): void {
    if (this._emitChangeScheduled) return;
    const ctrl = this._controller;
    if (!ctrl) return;
    this._emitChangeScheduled = true;
    queueMicrotask(() => {
      this._emitChangeScheduled = false;
      const current = this._controller;
      if (!current) return;
      this._events.emit(UploaderEventType.CHANGE, buildOutputCollectionState(current) as OutputCollectionState);
    });
  }

  private async _clientOptions(cfg: Cfg): Promise<FileFromOptions> {
    const secure = (await this._secureUploads?.getSecureToken()) ?? null;
    return {
      publicKey: cfg.pubkey ?? '',
      baseURL: cfg.baseUrl,
      baseCDN: cfg.cdnCname,
      store: cfg.store as never,
      userAgent: customUserAgent,
      integration: cfg.userAgentIntegration || undefined,
      retryThrottledRequestMaxTimes: cfg.retryThrottledRequestMaxTimes,
      retryNetworkErrorMaxTimes: cfg.retryNetworkErrorMaxTimes,
      multipartMinFileSize: cfg.multipartMinFileSize,
      multipartChunkSize: cfg.multipartChunkSize,
      maxConcurrentRequests: cfg.multipartMaxConcurrentRequests,
      secureSignature: secure?.secureSignature,
      secureExpire: secure?.secureExpire,
    };
  }
}
