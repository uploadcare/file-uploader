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
import { Disposables } from '../di/Disposables';
import { inject } from '../di/inject';
import { ConfigController } from './ConfigController';
import { SecureUploadsController } from './SecureUploadsController';
import { UploadCollectionController } from './UploadCollectionController';
import { UploadHostBridge } from './UploadHostBridge';

/**
 * DOM-free upload engine — owns the upload-client queue and the per-entry
 * upload task that v1 ran inside `FileItem._upload()`.
 *
 * `uploadEntry(uid)` performs the full task: preconditions, the
 * `isUploading`/`isQueuedForUploading` state writes, the per-entry
 * `AbortController`, the `beforeUpload` hook chain (with per-hook timeout +
 * isolation), upload-client option assembly, the queued `uploadFile` call,
 * progress, and the success/cancel/error write-back. Container-resolved (M-god
 * step 5): controller peers (config, collection, secure-uploads) and the
 * `UploadHostBridge` (plugin hooks, output-item resolver, telemetry sink, debug)
 * are `@inject`-ed, so it runs zero-arg without a DOM and is unit-testable; the
 * FileItem UI reacts to the same entry mutations through its existing per-entry
 * subscriptions.
 */
export class UploadController {
  @inject(ConfigController) private readonly _config!: ConfigController;
  @inject(UploadCollectionController) private readonly _collection!: UploadCollectionController;
  @inject(SecureUploadsController) private readonly _secureUploads!: SecureUploadsController;
  @inject(UploadHostBridge) private readonly _host!: UploadHostBridge;

  // One queue per uploader scope → global concurrency across all entries (v1 parity).
  private _queue = new Queue(1);
  readonly #disposables = new Disposables();

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
      return configValue(this._host.getOutputItem(uid));
    }
    return configValue;
  }

  public async uploadEntry(uid: Uid): Promise<void> {
    const entry = this._collection.read(uid);
    if (!entry) {
      return;
    }

    if (
      entry.getValue('fileInfo') ||
      entry.getValue('isUploading') ||
      entry.getValue('errors').length > 0 ||
      entry.getValue('isValidationPending')
    ) {
      return;
    }
    const { multiple, multipleMax } = this._config.values;
    const max = multiple ? multipleMax : 1;
    if (max && this._collection.size > max) {
      return;
    }

    entry.setMultipleValues({
      isUploading: true,
      errors: [],
      isQueuedForUploading: true,
    });

    try {
      const abortController = new AbortController();
      entry.setValue('abortController', abortController);

      const uploadTask = async (): Promise<UploadcareFile> => {
        entry.setValue('isQueuedForUploading', false);
        let file: File | Blob | null = entry.getValue('file');

        if (file instanceof File || file instanceof Blob) {
          const beforeUploadHooks = this._host.getFileHooks().filter((h) => h.type === 'beforeUpload');
          for (const hook of beforeUploadHooks) {
            try {
              const hookPromise = hook.handler({ file, signal: abortController.signal });
              const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error(`beforeUpload hook timed out`)), hook.timeout),
              );
              const { file: newFile } = await Promise.race([hookPromise, timeoutPromise]);
              if (newFile !== file) {
                file = newFile;
                entry.setValue('mimeType', file.type || null);
                entry.setValue('isImage', fileIsImage(file));
                entry.setValue('fileSize', file.size);
                if (file instanceof File) {
                  entry.setValue('fileName', file.name);
                }
              }
            } catch (error) {
              console.warn(`File hook "beforeUpload" from plugin "${hook.pluginId}" failed`, error);
            }
          }
        }

        const fileInput = file || entry.getValue('externalUrl') || entry.getValue('uuid');
        if (!fileInput) {
          throw new Error('No file input');
        }
        const baseUploadClientOptions = await this.buildUploadOptions();
        const uploadClientOptions: FileFromOptions = {
          ...baseUploadClientOptions,
          fileName: entry.getValue('fileName') ?? undefined,
          source: entry.getValue('source') ?? undefined,
          onProgress: (progress) => {
            if (progress.isComputable) {
              const percentage = progress.value * 100;
              entry.setValue('uploadProgress', percentage);
            }
          },
          signal: abortController.signal,
          metadata: await this.getMetadataFor(uid),
        };
        this._host.debug('upload options', fileInput, uploadClientOptions);
        return uploadFile(fileInput, uploadClientOptions);
      };

      const fileInfo = await this._queue.add(uploadTask);
      entry.setMultipleValues({
        fileInfo,
        isQueuedForUploading: false,
        isUploading: false,
        fileName: fileInfo.originalFilename,
        fileSize: fileInfo.size,
        isImage: fileInfo.isImage ?? false,
        mimeType: fileInfo.contentInfo?.mime?.mime ?? fileInfo.mimeType,
        uuid: fileInfo.uuid,
        cdnUrl: entry.getValue('cdnUrl') ?? fileInfo.cdnUrl,
        cdnUrlModifiers: entry.getValue('cdnUrlModifiers') ?? '',
        uploadProgress: 100,
        source: entry.getValue('source') ?? null,
      });
    } catch (cause) {
      const isCancelError = cause instanceof CancelError && cause.isCancel;
      if (isCancelError) {
        entry.setMultipleValues({
          isUploading: false,
          uploadProgress: 0,
        });
      } else if (cause instanceof UploadcareError) {
        entry.setMultipleValues({
          isUploading: false,
          uploadProgress: 0,
          uploadError: cause,
        });
      } else {
        console.error('Unknown upload error', cause);
        entry.setMultipleValues({
          isUploading: false,
          uploadProgress: 0,
          // TODO: Add translation?
          uploadError: new Error('Something went wrong', {
            cause,
          }),
        });
      }

      if (!isCancelError) {
        this._host.onUploadError(cause, 'file upload. Failed to upload file');
      }
    }
  }

  public abort(uid: Uid): void {
    this._collection.read(uid)?.getValue('abortController')?.abort();
  }

  public destroy(): void {
    this.#disposables.run();
  }
}
