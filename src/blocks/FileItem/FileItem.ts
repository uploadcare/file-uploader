import { shrinkFile } from '@uploadcare/image-shrink';
import {
  CancelError,
  type FileFromOptions,
  UploadcareError,
  type UploadcareFile,
  uploadFile,
} from '@uploadcare/upload-client';
import { html, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { UploadEntryTypedData } from '../../abstract/uploadEntrySchema';
import { LitActivityBlock } from '../../lit/LitActivityBlock';
import { debounce } from '../../utils/debounce';
import { parseShrink } from '../../utils/parseShrink';
import { throttle } from '../../utils/throttle';
import { ExternalUploadSource } from '../../utils/UploadSource';
import './file-item.css';
import { EventType, InternalEventType } from '../UploadCtxProvider/EventEmitter';
import { FileItemConfig } from './FileItemConfig';

const FileItemState = Object.freeze({
  FINISHED: Symbol('FINISHED'),
  FAILED: Symbol('FAILED'),
  UPLOADING: Symbol('UPLOADING'),
  VALIDATION: Symbol('VALIDATION'),
  QUEUED_UPLOADING: Symbol('QUEUED-UPLOADING'),
  QUEUED_VALIDATION: Symbol('QUEUED-VALIDATION'),
  IDLE: Symbol('IDLE'),
} as const);

type FileItemStateValue = (typeof FileItemState)[keyof typeof FileItemState];

type UploadTrigger = Set<string>;

export class FileItem extends FileItemConfig {
  override couldBeCtxOwner = true;
  pauseRender = true;

  @property({ type: String, attribute: false })
  uid = '';

  @state()
  protected itemName = '';

  @state()
  protected errorText = '';

  @state()
  protected hint = '';

  @state()
  protected progressValue = 0;

  @state()
  protected progressVisible = false;

  @state()
  protected badgeIcon = '';

  @state()
  protected isFinished = false;

  @state()
  protected isFailed = false;

  @state()
  protected isUploading = false;

  @state()
  protected isFocused = false;

  @state()
  protected isEditable = false;

  @state()
  protected showFileNames = false;

  @state()
  protected ariaLabelStatusFile = '';

  private _renderedOnce = false;
  private _observer?: IntersectionObserver;
  protected _isIntersecting = false;
  protected _thumbRect?: DOMRectReadOnly;

  private _handleEdit = this._withEntry((entry) => {
    this.telemetryManager.sendEvent({
      payload: {
        metadata: {
          event: 'edit-file',
          node: this.tagName,
        },
      },
    });
    this.$['*currentActivityParams'] = {
      internalId: entry.uid,
    };
    this.modalManager?.open(LitActivityBlock.activities.CLOUD_IMG_EDIT);
    this.$['*currentActivity'] = LitActivityBlock.activities.CLOUD_IMG_EDIT;
  });

  private _handleRemove = (): void => {
    this.telemetryManager.sendEvent({
      payload: {
        metadata: {
          event: 'remove-file',
          node: this.tagName,
        },
      },
    });

    if (this.uid) {
      this.uploadCollection.remove(this.uid);
    }
  };

  private _handleUploadClick = (): void => {
    this.upload();
  };

  private _calculateState(): void {
    const entry = this._entry;
    if (!entry) {
      return;
    }

    let state: FileItemStateValue = FileItemState.IDLE;

    if (entry.getValue('errors').length > 0) {
      state = FileItemState.FAILED;
    } else if (entry.getValue('isQueuedForUploading')) {
      state = FileItemState.QUEUED_UPLOADING;
    } else if (entry.getValue('isQueuedForValidation')) {
      state = FileItemState.QUEUED_VALIDATION;
    } else if (entry.getValue('isValidationPending')) {
      state = FileItemState.VALIDATION;
    } else if (entry.getValue('isUploading')) {
      state = FileItemState.UPLOADING;
    } else if (entry.getValue('fileInfo')) {
      state = FileItemState.FINISHED;
    }

    this._handleState(entry, state);
  }

  private _debouncedCalculateState = debounce(() => this._calculateState(), 100);

  private _updateHintAndProgress = this._withEntry(
    throttle((entry: UploadEntryTypedData, state?: FileItemStateValue) => {
      const errorText = entry.getValue('errors')?.[0]?.message ?? '';
      const source = entry.getValue('source');
      const externalUrl = entry.getValue('externalUrl');
      const isFinished = state === FileItemState.FINISHED;
      const isUploading = state === FileItemState.UPLOADING;
      const isQueuedForUploading = state === FileItemState.QUEUED_UPLOADING;
      const isQueuedForValidation = state === FileItemState.QUEUED_VALIDATION;
      const isValidationPending = state === FileItemState.VALIDATION;
      const fileName = entry.getValue('fileName');
      let hint = '';

      if (errorText) {
        hint = '';
      } else if (!isFinished && externalUrl && source && Object.values(ExternalUploadSource).includes(source)) {
        hint = this.l10n('waiting-for', { source: this.l10n(`src-type-${source}`) });
      }

      this.hint = hint;
      this.errorText = errorText;
      this.progressVisible = isUploading || isQueuedForUploading || isQueuedForValidation || isValidationPending;
      this.progressValue = isQueuedForValidation || isValidationPending ? 0 : entry.getValue('uploadProgress');
      this.ariaLabelStatusFile = fileName
        ? this.l10n('a11y-file-item-status', {
            fileName,
            status: this.l10n(state?.description?.toLocaleLowerCase() ?? '').toLocaleLowerCase(),
          })
        : '';
    }, 100),
  );

  private _handleState(entry: UploadEntryTypedData, state: FileItemStateValue): void {
    if (state === FileItemState.FAILED) {
      this.badgeIcon = 'badge-error';
    } else if (state === FileItemState.FINISHED) {
      this.badgeIcon = 'badge-success';
    }

    if (state === FileItemState.UPLOADING) {
      this.isFocused = false;
      this.removeAttribute('focused');
    }

    this.isFailed = state === FileItemState.FAILED;
    this.isUploading = state === FileItemState.UPLOADING;
    this.isFinished = state === FileItemState.FINISHED;
    this.isEditable = Boolean(this.cfg.useCloudImageEditor && entry.getValue('isImage') && entry.getValue('cdnUrl'));

    this._updateHintAndProgress(state);
  }

  override _reset(): void {
    super._reset();
    this._debouncedCalculateState.cancel();
  }

  private _observerCallback(entries: IntersectionObserverEntry[]): void {
    const [entry] = entries;
    if (!entry) {
      return;
    }

    this._isIntersecting = entry.isIntersecting;
    this._thumbRect = entry.boundingClientRect;

    if (entry.isIntersecting && !this._renderedOnce) {
      this.pauseRender = false;
      this._renderedOnce = true;
    }
  }

  private _handleEntryId(id: string): void {
    this._reset();

    const entry = this.uploadCollection?.read(id);
    this._entry = entry;

    if (!entry) {
      return;
    }

    this._subEntry('isQueuedForValidation', () => {
      this._debouncedCalculateState();
    });

    this._subEntry('isValidationPending', () => {
      this._debouncedCalculateState();
    });

    this._subEntry('uploadProgress', () => {
      this._debouncedCalculateState();
    });

    this._subEntry('isQueuedForUploading', () => {
      this._debouncedCalculateState();
    });

    this._subEntry('fileName', (name) => {
      this.itemName = name || entry.getValue('externalUrl') || this.l10n('file-no-name');
      this._debouncedCalculateState();
    });

    this._subEntry('externalUrl', (externalUrl) => {
      this.itemName = entry.getValue('fileName') || externalUrl || this.l10n('file-no-name');
    });

    this._subEntry('fileInfo', () => {
      this._debouncedCalculateState();
    });

    this._subEntry('errors', () => this._debouncedCalculateState());
    this._subEntry('isUploading', () => this._debouncedCalculateState());
    this._subEntry('fileSize', () => this._debouncedCalculateState());
    this._subEntry('mimeType', () => this._debouncedCalculateState());
    this._subEntry('isImage', () => this._debouncedCalculateState());

    this._calculateState();
  }

  private _updateShowFileNames(value: boolean): void {
    const isListMode = this.cfg.filesViewMode === 'list';
    if (isListMode) {
      this.showFileNames = true;
      return;
    }

    this.showFileNames = value;
  }

  protected override willUpdate(changedProperties: PropertyValues<this>): void {
    super.willUpdate(changedProperties);

    if (changedProperties.has('uid')) {
      this._handleEntryId(this.uid);
    }
  }

  override initCallback(): void {
    super.initCallback();

    this._handleEntryId(this.uid);

    this.subConfigValue('useCloudImageEditor', () => this._debouncedCalculateState());

    this.subConfigValue('filesViewMode', (mode) => {
      this._updateShowFileNames(this.cfg.gridShowFileNames);

      this.setAttribute('mode', mode);
    });

    this.subConfigValue('gridShowFileNames', (value) => {
      this._updateShowFileNames(value);
    });

    this.onclick = () => {
      FileItem.activeInstances.forEach((inst) => {
        if (inst === this) {
          inst.setAttribute('focused', '');
        } else {
          inst.removeAttribute('focused');
        }
      });
    };

    this.sub('*uploadTrigger', (itemsToUpload: UploadTrigger) => {
      if (this._entry && !itemsToUpload.has(this._entry.uid)) {
        return;
      }
      setTimeout(() => this.isConnected && this.upload());
    });
    FileItem.activeInstances.add(this);
  }

  override connectedCallback(): void {
    super.connectedCallback();

    this._observer = new window.IntersectionObserver(this._observerCallback.bind(this), {
      threshold: [0, 1],
    });
    this._observer.observe(this);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();

    this._observer?.disconnect();

    FileItem.activeInstances.delete(this);

    this._reset();
  }

  upload = this._withEntry(async (entry) => {
    if (!this.uploadCollection.read(entry.uid)) {
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
    const multipleMax = this.cfg.multiple ? this.cfg.multipleMax : 1;
    if (multipleMax && this.uploadCollection.size > multipleMax) {
      return;
    }

    entry.setMultipleValues({
      isUploading: true,
      errors: [],
      isQueuedForUploading: true,
    });

    this._debouncedCalculateState();

    try {
      const abortController = new AbortController();
      entry.setValue('abortController', abortController);

      const uploadTask = async (): Promise<UploadcareFile> => {
        entry.setValue('isQueuedForUploading', false);
        let file: File | Blob | null = entry.getValue('file');
        if (file instanceof File && this.cfg.imageShrink) {
          try {
            const settings = parseShrink(this.cfg.imageShrink);
            if (!settings) {
              console.warn('Image shrink settings are invalid, skipping shrinking');
            } else {
              file = await shrinkFile(file, settings);
            }
          } catch {
            // keep original file if shrinking fails
          }
        }

        const fileInput = file || entry.getValue('externalUrl') || entry.getValue('uuid');
        if (!fileInput) {
          throw new Error('No file input');
        }
        const baseUploadClientOptions = await this.getUploadClientOptions();
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
          metadata: await this.getMetadataFor(entry.uid),
        };
        this.debugPrint('upload options', fileInput, uploadClientOptions);
        return uploadFile(fileInput, uploadClientOptions);
      };

      const fileInfo = await this.$['*uploadQueue'].add(uploadTask);
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

      if (entry === this._entry) {
        this._debouncedCalculateState();
      }
    } catch (cause) {
      this.telemetryManager.sendEventError(cause, 'file upload. Failed to upload file');
      if (cause instanceof CancelError && cause.isCancel) {
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

      if (entry === this._entry) {
        this._debouncedCalculateState();
      }
    }
  });

  static activeInstances: Set<FileItem> = new Set<FileItem>();

  protected override shouldUpdate(_changedProperties: PropertyValues): boolean {
    return this.pauseRender === false;
  }

  override render() {
    return html`
      <div class="uc-inner" ?finished=${this.isFinished} ?uploading=${this.isUploading} ?failed=${this.isFailed} ?focused=${this.isFocused}>
        <uc-thumb .uid=${this.uid} .badgeIcon=${this.badgeIcon}></uc-thumb>

        <div aria-atomic="true" aria-live="polite" class="uc-file-name-wrapper" aria-label=${this.ariaLabelStatusFile}>
          <span class="uc-file-name" ?hidden=${!this.showFileNames}>${this.itemName}</span>
          <span class="uc-file-error" ?hidden=${!this.errorText}>${this.errorText}</span>
          <span class="uc-file-hint" ?hidden=${!this.hint}>${this.hint}</span>
        </div>
        <div class="uc-file-actions">
          <button
            type="button"
            @click=${this._handleEdit}
            ?hidden=${!this.isEditable}
            title=${this.l10n('file-item-edit-button')}
            aria-label=${this.l10n('file-item-edit-button')}
            class="uc-edit-btn uc-mini-btn"
            data-testid="edit"
          >
            <uc-icon name="edit-file"></uc-icon>
          </button>
          <button
            type="button"
            @click=${this._handleRemove}
            title=${this.l10n('file-item-remove-button')}
            aria-label=${this.l10n('file-item-remove-button')}
            class="uc-remove-btn uc-mini-btn"
          >
            <uc-icon name="remove-file"></uc-icon>
          </button>
          <button type="button" class="uc-upload-btn uc-mini-btn" @click=${this._handleUploadClick}>
            <uc-icon name="upload"></uc-icon>
          </button>
        </div>
        <uc-progress-bar class="uc-progress-bar" .value=${this.progressValue} .visible=${this.progressVisible} ?hasFileName=${this.showFileNames}>
        </uc-progress-bar>
      </div>
    `;
  }
}
