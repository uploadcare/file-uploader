import {
  CancelError,
  type FileFromOptions,
  Queue,
  UploadcareError,
  type UploadcareFile,
  uploadFile,
} from '@uploadcare/upload-client';
import type { Uid } from '../../lit/Uid';
import { fileIsImage } from '../../utils/fileTypes';
import { customUserAgent } from '../../utils/userAgent';
import { controllerLogger } from '../controllerLogger';
import { containerOf } from '../di/ControllerContainer';
import { Disposables } from '../di/Disposables';
import { inject } from '../di/inject';
import { lazy } from '../logger';
import { PluginController } from '../managers/plugin';
import { TelemetryManager } from '../managers/TelemetryManager';
import { UploaderPublicApi } from '../UploaderPublicApi';
import { ConfigController } from './ConfigController';
import { SecureUploadsController } from './SecureUploadsController';
import { UploadCollectionController } from './UploadCollectionController';

/**
 * DOM-free upload engine — owns the upload-client queue and the per-entry
 * upload task that v1 ran inside `FileItem._upload()`.
 *
 * `uploadEntry(uid)` performs the full task: preconditions, the
 * `isUploading`/`isQueuedForUploading` state writes, the per-entry
 * `AbortController`, the `beforeUpload` hook chain (with per-hook timeout +
 * isolation), upload-client option assembly, the queued `uploadFile` call,
 * progress, and the success/cancel/error write-back. Container-resolved (M-god
 * step 5): controller peers (config, collection, secure-uploads), the public API
 * (output-item resolver) and `TelemetryManager` (the never-throwing upload-error
 * sink) are `@inject`-ed; plugin `beforeUpload` hooks are read from the
 * conditionally-bound `PluginController` via the container (`containerOf`). So it
 * runs zero-arg without a DOM and is unit-testable; debug output goes through the
 * per-ctx `this._log` (gated by this ctx's `debug` config); the FileItem UI
 * reacts to the same entry mutations through its existing per-entry
 * subscriptions.
 */
export class UploadController {
  @inject(ConfigController) private readonly _config!: ConfigController;
  @inject(UploadCollectionController) private readonly _collection!: UploadCollectionController;
  @inject(SecureUploadsController) private readonly _secureUploads!: SecureUploadsController;
  // Token thunk: `UploaderPublicApi` `@inject`s `UploadController` back, so a
  // direct token reference here would form a value-import cycle that leaves one
  // side `undefined` at decoration time. The thunk defers the lookup to
  // resolution time (lazy field), breaking the cycle.
  @inject(() => UploaderPublicApi) private readonly _api!: UploaderPublicApi;
  @inject(TelemetryManager) private readonly _telemetry!: TelemetryManager;

  // Per-ctx gated logger: the verbose tier prints only when THIS ctx's `debug`
  // config is on; ctx-name + gate resolve lazily at log time via the container
  // that built this instance.
  private readonly _log = controllerLogger(this, 'upload');

  // One queue per uploader scope → global concurrency across all entries (v1 parity).
  private _queue = new Queue(1);
  readonly #disposables = new Disposables();

  // Uids in the current upload batch — the set most recently handed to
  // `uploadEntries` (i.e. a `uploadAll`), minus entries that have since been
  // removed. It is the denominator for common-progress; kept here (the upload
  // owner) rather than as a replaceable-`Set` state key.
  readonly #activeBatch = new Set<Uid>();

  /**
   * Container lifecycle hook — runs after the container has tagged + cached this
   * instance, so `@inject` fields resolve (they must NOT be read in the zero-arg
   * constructor, which runs before the container tags the instance). Seeds the
   * queue concurrency and subscribes to config changes, exactly as v1's
   * construction-time wiring did.
   */
  public init(): void {
    this._queue.concurrency = this._concurrencyFromConfig();
    this.#disposables.add(
      this._config.subscribe(() => {
        this._queue.concurrency = this._concurrencyFromConfig();
      }),
    );
    // Drop removed entries from the active batch so common-progress doesn't
    // average over uids that no longer exist.
    this.#disposables.add(
      this._collection.observeCollection((_list, _added, removed) => {
        for (const entry of removed) {
          this.#activeBatch.delete(entry.uid);
        }
      }),
    );
  }

  /**
   * Upload the given entries: the direct successor to the v1 `*uploadTrigger`
   * broadcast. Each uid is added to the active batch and uploaded via
   * `uploadEntry` (which is precondition-guarded + idempotent). Unlike the old
   * per-`<uc-file-item>` trigger, this doesn't depend on any item being rendered.
   *
   * The `uploadEntry` call is deferred a macrotask (as the v1 per-item
   * `setTimeout(() => _upload())` was): a file added in the same tick kicks off
   * async validation that sets `isValidationPending`, and `uploadEntry` bails on
   * a pending entry — so we let that settle first rather than racing it.
   */
  public uploadEntries(uids: Uid[]): void {
    for (const uid of uids) {
      this.#activeBatch.add(uid);
      setTimeout(() => {
        void this.uploadEntry(uid);
      });
    }
  }

  /** Uids in the current upload batch that still exist — the common-progress set. */
  public get uploadBatch(): Uid[] {
    return [...this.#activeBatch].filter((uid) => !!this._collection.read(uid));
  }

  private _concurrencyFromConfig(): number {
    // Clamp to a positive integer: a negative/fractional/non-numeric
    // `maxConcurrentRequests` would otherwise produce invalid queue concurrency.
    const raw = Number(this._config.get('maxConcurrentRequests'));
    return Number.isFinite(raw) ? Math.max(1, Math.floor(raw)) : 1;
  }

  /**
   * Assemble the base upload-client options from config + the secure token.
   * Public because group upload (`uploadFileGroup`) reuses the same options.
   */
  public async buildUploadOptions(): Promise<FileFromOptions> {
    const secureToken = await this._secureUploads.getSecureToken().catch(() => null);
    const cfg = this._config.values;

    // Assigned to a local (not returned as a literal) so the extra
    // `multipartMaxAttempts` passthrough is preserved exactly as v1 had it —
    // upload-client ignores keys it doesn't type, and a direct-literal return
    // would trip excess-property checking.
    const options = {
      store: cfg.store,
      publicKey: cfg.pubkey,
      baseCDN: cfg.cdnCname,
      baseURL: cfg.baseUrl,
      userAgent: customUserAgent,
      integration: cfg.userAgentIntegration,
      secureSignature: secureToken?.secureSignature,
      secureExpire: secureToken?.secureExpire,
      retryThrottledRequestMaxTimes: cfg.retryThrottledRequestMaxTimes,
      retryNetworkErrorMaxTimes: cfg.retryNetworkErrorMaxTimes,
      multipartMinFileSize: cfg.multipartMinFileSize,
      multipartChunkSize: cfg.multipartChunkSize,
      maxConcurrentRequests: cfg.multipartMaxConcurrentRequests,
      multipartMaxAttempts: cfg.multipartMaxAttempts,
      checkForUrlDuplicates: !!cfg.checkForUrlDuplicates,
      saveUrlForRecurrentUploads: !!cfg.saveUrlForRecurrentUploads,
    };

    return options;
  }

  /** Resolve the documented `metadata` config (static value or per-entry callback). */
  public async getMetadataFor(uid: Uid): Promise<FileFromOptions['metadata']> {
    const configValue = this._config.values.metadata || undefined;
    if (typeof configValue === 'function') {
      return configValue(this._api.getOutputItem(uid));
    }
    return configValue;
  }

  /** Resolve the documented `tags` config (static value or per-entry callback). */
  public async getTagsFor(uid: Uid): Promise<FileFromOptions['tags']> {
    const configValue = this._config.values.tags || undefined;
    if (typeof configValue === 'function') {
      return configValue(this._api.getOutputItem(uid));
    }
    return configValue;
  }

  public async uploadEntry(uid: Uid): Promise<void> {
    const entry = this._collection.read(uid);
    if (!entry) {
      return;
    }

    if (
      entry.get('fileInfo') ||
      entry.get('isUploading') ||
      entry.get('errors').length > 0 ||
      entry.get('isValidationPending')
    ) {
      return;
    }
    const { multiple, multipleMax } = this._config.values;
    const max = multiple ? multipleMax : 1;
    if (max && this._collection.size > max) {
      return;
    }

    entry.setMany({
      isUploading: true,
      errors: [],
      isQueuedForUploading: true,
    });

    try {
      const abortController = new AbortController();
      entry.set('abortController', abortController);

      const uploadTask = async (): Promise<UploadcareFile> => {
        entry.set('isQueuedForUploading', false);
        let file: File | Blob | null = entry.get('file');

        if (file instanceof File || file instanceof Blob) {
          // Plugin hooks live on the conditionally-bound `PluginController`
          // (absent in an editor-only ctx, bound by `ensurePluginManager`);
          // resolve it through the container, matching the removed bridge's
          // `getOrNull(PluginController)?.snapshot().fileHooks ?? []`.
          const fileHooks = containerOf(this)?.getOrNull(PluginController)?.snapshot().fileHooks ?? [];
          const beforeUploadHooks = fileHooks.filter((h) => h.type === 'beforeUpload');
          for (const hook of beforeUploadHooks) {
            try {
              const hookPromise = hook.handler({ file, signal: abortController.signal });
              const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error(`beforeUpload hook timed out`)), hook.timeout),
              );
              const { file: newFile } = await Promise.race([hookPromise, timeoutPromise]);
              if (newFile !== file) {
                file = newFile;
                entry.set('mimeType', file.type || null);
                entry.set('isImage', fileIsImage(file));
                entry.set('fileSize', file.size);
                if (file instanceof File) {
                  entry.set('fileName', file.name);
                }
              }
            } catch (error) {
              this._log.warn(`File hook "beforeUpload" from plugin "${hook.pluginId}" failed`, error);
            }
          }
        }

        const fileInput = file || entry.get('externalUrl') || entry.get('uuid');
        if (!fileInput) {
          throw new Error('No file input');
        }
        const baseUploadClientOptions = await this.buildUploadOptions();
        const uploadClientOptions: FileFromOptions = {
          ...baseUploadClientOptions,
          fileName: entry.get('fileName') ?? undefined,
          source: entry.get('source') ?? undefined,
          onProgress: (progress) => {
            if (progress.isComputable) {
              const percentage = progress.value * 100;
              entry.set('uploadProgress', percentage);
            }
          },
          signal: abortController.signal,
          metadata: await this.getMetadataFor(uid),
          tags: await this.getTagsFor(uid),
        };
        // Redact the signing credential from debug output — never print
        // `secureSignature` to the console. Lazy so the redacted copy is only
        // built when this ctx is verbose.
        this._log.debug(
          lazy(() => [
            'upload options',
            uploadClientOptions.secureSignature
              ? { ...uploadClientOptions, secureSignature: '[redacted]' }
              : uploadClientOptions,
          ]),
        );
        return uploadFile(fileInput, uploadClientOptions);
      };

      const fileInfo = await this._queue.add(uploadTask);
      entry.setMany({
        fileInfo,
        isQueuedForUploading: false,
        isUploading: false,
        fileName: fileInfo.originalFilename,
        fileSize: fileInfo.size,
        isImage: fileInfo.isImage ?? false,
        mimeType: fileInfo.contentInfo?.mime?.mime ?? fileInfo.mimeType,
        uuid: fileInfo.uuid,
        cdnUrl: entry.get('cdnUrl') ?? fileInfo.cdnUrl,
        cdnUrlModifiers: entry.get('cdnUrlModifiers') ?? '',
        uploadProgress: 100,
        source: entry.get('source') ?? null,
      });
    } catch (cause) {
      const isCancelError = cause instanceof CancelError && cause.isCancel;
      if (isCancelError) {
        entry.setMany({
          isUploading: false,
          uploadProgress: 0,
        });
      } else if (cause instanceof UploadcareError) {
        entry.setMany({
          isUploading: false,
          uploadProgress: 0,
          uploadError: cause,
        });
      } else {
        this._log.error('Unknown upload error', cause);
        entry.setMany({
          isUploading: false,
          uploadProgress: 0,
          // TODO: Add translation?
          uploadError: new Error('Something went wrong', {
            cause,
          }),
        });
      }

      if (!isCancelError) {
        this._telemetry.sendEventError(cause, 'file upload. Failed to upload file');
      }
    }
  }

  public abort(uid: Uid): void {
    this._collection.read(uid)?.get('abortController')?.abort();
  }

  public destroy(): void {
    this.#disposables.run();
  }
}
