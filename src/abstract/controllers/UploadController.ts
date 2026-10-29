import {
  AuthTokenResolverError,
  CancelError,
  type FileFromOptions,
  Queue,
  UploadcareError,
  type UploadcareFile,
  uploadFile,
} from '@uploadcare/upload-client';
import type { OutputFileEntry } from '../../types/exported';
import { fileDerivedFields } from '../../utils/fileTypes';
import { redactSecrets } from '../../utils/redactSecrets';
import { customUserAgent } from '../../utils/userAgent';
import { controllerLogger } from '../controllerLogger';
import { containerOf, lifetimeOf } from '../di/ControllerContainer';
import { Disposables } from '../di/Disposables';
import { inject } from '../di/inject';
import { lazy } from '../logger';
import { AuthTokenManager } from '../managers/AuthTokenManager';
import { PluginController } from '../managers/plugin';
import { runFileHook } from '../managers/plugin/runFileHook';
import { TelemetryManager } from '../managers/TelemetryManager';
import { toOutputFileEntry } from '../outputFileEntry';
import type { Uid } from '../Uid';
import { ConfigController } from './ConfigController';
import { SecureUploadsController } from './SecureUploadsController';
import { UploadCollectionController } from './UploadCollectionController';
import { UploadFileEventsController } from './UploadFileEventsController';
import { ValidationController } from './ValidationController';

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
  @inject(AuthTokenManager) private readonly _authToken!: AuthTokenManager;
  @inject(ConfigController) private readonly _config!: ConfigController;
  @inject(UploadCollectionController) private readonly _collection!: UploadCollectionController;
  @inject(UploadFileEventsController) private readonly _fileEvents!: UploadFileEventsController;
  @inject(SecureUploadsController) private readonly _secureUploads!: SecureUploadsController;
  @inject(TelemetryManager) private readonly _telemetry!: TelemetryManager;
  // Thunk: `ValidationController` reaches this class back through `UploaderPublicApi`, which validators receive.
  @inject(() => ValidationController) private readonly _validation!: ValidationController;

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
   * Upload the given entries. Each uid is added to the active batch and uploaded
   * via `uploadEntry` (which is precondition-guarded + idempotent), whether or not
   * any item is rendered.
   */
  public uploadEntries(uids: Uid[]): void {
    for (const uid of uids) {
      this.#activeBatch.add(uid);
      lifetimeOf(this).run(
        () => this.uploadEntry(uid),
        (error) => this._log.error('Upload failed', error),
      );
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
    const authToken = this._authToken.getAuthToken();
    const secureToken = authToken ? null : await this._secureUploads.getSecureToken().catch(() => null);
    const cfg = this._config.values;

    // Returned as a literal so excess-property checking catches a key upload-client doesn't take — an untyped local
    // let `multipartMaxAttempts` reach it unchecked for years after upload-client 5 dropped it.
    return {
      authToken,
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
      checkForUrlDuplicates: !!cfg.checkForUrlDuplicates,
      saveUrlForRecurrentUploads: !!cfg.saveUrlForRecurrentUploads,
    };
  }

  private _outputEntry(uid: Uid): OutputFileEntry {
    const entry = this._collection.read(uid);
    if (!entry) {
      throw new Error(`Entry with ID "${uid}" not found in the upload collection`);
    }
    return toOutputFileEntry(entry);
  }

  /** Resolve the documented `metadata` config (static value or per-entry callback). */
  public async getMetadataFor(uid: Uid): Promise<FileFromOptions['metadata']> {
    const configValue = this._config.values.metadata || undefined;
    if (typeof configValue === 'function') {
      return configValue(this._outputEntry(uid));
    }
    return configValue;
  }

  /** Resolve the documented `tags` config (static value or per-entry callback). */
  public async getTagsFor(uid: Uid): Promise<FileFromOptions['tags']> {
    const configValue = this._config.values.tags || undefined;
    if (typeof configValue === 'function') {
      return configValue(this._outputEntry(uid));
    }
    return configValue;
  }

  public async uploadEntry(uid: Uid): Promise<void> {
    // Bound to the ctx: once it is torn down nothing here may touch a peer, so an entry still waiting for its
    // validators or still queued does not start, and a late result or failure is dropped.
    const lifetime = lifetimeOf(this);
    if (lifetime.signal.aborted) {
      return;
    }
    const entry = this._collection.read(uid);
    // A failed upload is final: `uploadError` turns into `errors` only on the next validation run, so until then
    // the entry would otherwise look ready to send again.
    if (!entry || entry.get('fileInfo') || entry.get('isUploading') || entry.get('uploadError')) {
      return;
    }

    // A file added in this same tick has not met its validators yet: wait for them, then re-check, so a rejected
    // file is never sent. A second call for the same entry finds it uploading once the first one resumes.
    await lifetime.guard(this._validation.whenValidated(entry));
    if (entry.get('errors').length > 0) {
      // Rejected, so never uploaded: the common progress counts only files that were ready to upload.
      this.#activeBatch.delete(uid);
      return;
    }
    if (
      !this._collection.read(uid) ||
      entry.get('fileInfo') ||
      entry.get('isUploading') ||
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
    this._fileEvents.start(entry);

    const abortController = new AbortController();
    // Destroying the ctx cancels the request (and any `beforeUpload` hook) the way removing the file does: nothing
    // is sent once the uploader is gone. Removed once the upload settles, so listeners don't pile up on the ctx.
    const abortOnTeardown = () => abortController.abort();
    lifetime.signal.addEventListener('abort', abortOnTeardown, { once: true });
    try {
      entry.set('abortController', abortController);

      const uploadTask = async (): Promise<UploadcareFile> => {
        lifetime.signal.throwIfAborted();
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
            // A hook is a user callback: the next one is not invoked once the ctx is torn down.
            lifetime.signal.throwIfAborted();
            try {
              const { file: newFile } = await runFileHook(hook, file, abortController.signal);
              if (newFile !== file) {
                file = newFile;
                entry.setMany(fileDerivedFields(file));
              }
            } catch (error) {
              // Aborted by a cancel or by the ctx going away: the hook did what its signal asked, and the aborted
              // signal ends the upload below the same way it always has.
              if (abortController.signal.aborted) {
                break;
              }
              this._log.warn(`File hook "beforeUpload" from plugin "${hook.pluginId}" failed`, error);
            }
          }
        }

        // The hooks above may have outlived the ctx.
        lifetime.signal.throwIfAborted();
        const fileInput = file || entry.get('externalUrl') || entry.get('uuid');
        if (!fileInput) {
          throw new Error('No file input');
        }
        const baseUploadClientOptions = await lifetime.guard(this.buildUploadOptions());
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
          metadata: await lifetime.guard(this.getMetadataFor(uid)),
          tags: await lifetime.guard(this.getTagsFor(uid)),
        };
        // Redact the signing credential from debug output — never print
        // `secureSignature` to the console. Lazy so the redacted copy is only
        // built when this ctx is verbose.
        this._log.debug(lazy(() => ['upload options', redactSecrets(uploadClientOptions)]));
        return uploadFile(fileInput, uploadClientOptions);
      };

      const fileInfo = await lifetime.guard(this._queue.add(uploadTask));
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
      if (lifetime.signal.aborted) {
        return;
      }
      const isCancelError = cause instanceof CancelError && cause.isCancel;
      if (isCancelError) {
        entry.setMany({
          isUploading: false,
          uploadProgress: 0,
        });
      } else if (cause instanceof UploadcareError || cause instanceof AuthTokenResolverError) {
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
    } finally {
      lifetime.signal.removeEventListener('abort', abortOnTeardown);
    }
  }

  public destroy(): void {
    this.#disposables.run();
  }
}
