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
import type { Uid } from '../../lit/Uid';
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

export class FileItem extends FileItemConfig {
  protected override couldBeCtxOwner = true;

  @state()
  private _pauseRender = true;

  @property({ type: String, attribute: false })
  public uid: Uid = '' as Uid;

  @state()
  private _itemName = '';

  @state()
  private _errorText = '';

  @state()
  private _hint = '';

  @state()
  private _progressValue = 0;

  @state()
  private _progressVisible = false;

  @state()
  private _badgeIcon = '';

  @state()
  private _isFinished = false;

  @state()
  private _isFailed = false;

  @state()
  private _isUploading = false;

  @state()
  private _isFocused = false;

  @state()
  private _isEditable = false;

  @state()
  private _showFileNames = false;

  @state()
  private _ariaLabelStatusFile = '';

  private _renderedOnce = false;
  private _observer?: IntersectionObserver;

  private _handleEdit = this.withEntry((entry) => {
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

    if (this.uid && this.uploadCollection.hasItem(this.uid)) {
      this.uploadCollection.remove(this.uid);
    }
  };

  private _handleUploadClick = (): void => {
    this._upload();
  };

  private _calculateState(): void {
    const entry = this.entry;
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

  private _updateHintAndProgress = this.withEntry(
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

      this._hint = hint;
      this._errorText = errorText;
      this._progressVisible = isUploading || isQueuedForUploading || isQueuedForValidation || isValidationPending;
      this._progressValue = isQueuedForValidation || isValidationPending ? 0 : entry.getValue('uploadProgress');
      this._ariaLabelStatusFile = fileName
        ? this.l10n('a11y-file-item-status', {
            fileName,
            status: this.l10n(state?.description?.toLocaleLowerCase() ?? '').toLocaleLowerCase(),
          })
        : '';
    }, 100),
  );

  private _handleState(entry: UploadEntryTypedData, state: FileItemStateValue): void {
    if (state === FileItemState.FAILED) {
      this._badgeIcon = 'badge-error';
    } else if (state === FileItemState.FINISHED) {
      this._badgeIcon = 'badge-success';
    }

    if (state === FileItemState.UPLOADING) {
      this._isFocused = false;
      this.removeAttribute('focused');
    }

    this._isFailed = state === FileItemState.FAILED;
    this._isUploading = state === FileItemState.UPLOADING;
    this._isFinished = state === FileItemState.FINISHED;
    this._isEditable = Boolean(this.cfg.useCloudImageEditor && entry.getValue('isImage') && entry.getValue('cdnUrl'));

    this._updateHintAndProgress(state);
  }

  protected override reset(): void {
    super.reset();
    this._debouncedCalculateState.cancel();
  }

  private _observerCallback(entries: IntersectionObserverEntry[]): void {
    const [entry] = entries;
    if (!entry) {
      return;
    }

    if (entry.isIntersecting && !this._renderedOnce) {
      this._pauseRender = false;
      this._renderedOnce = true;
    }
  }

  private _handleEntryId(id: Uid): void {
    this.reset();

    const entry = this.uploadCollection?.read(id);
    this.entry = entry;

    if (!entry) {
      return;
    }

    this.subEntry('isQueuedForValidation', () => {
      this._debouncedCalculateState();
    });

    this.subEntry('isValidationPending', () => {
      this._debouncedCalculateState();
    });

    this.subEntry('uploadProgress', () => {
      this._debouncedCalculateState();
    });

    this.subEntry('isQueuedForUploading', () => {
      this._debouncedCalculateState();
    });

    this.subEntry('fileName', (name) => {
      this._itemName = name || entry.getValue('externalUrl') || this.l10n('file-no-name');
      this._debouncedCalculateState();
    });

    this.subEntry('externalUrl', (externalUrl) => {
      this._itemName = entry.getValue('fileName') || externalUrl || this.l10n('file-no-name');
    });

    this.subEntry('fileInfo', () => {
      this._debouncedCalculateState();
    });

    this.subEntry('errors', () => this._debouncedCalculateState());
    this.subEntry('isUploading', () => this._debouncedCalculateState());
    this.subEntry('fileSize', () => this._debouncedCalculateState());
    this.subEntry('mimeType', () => this._debouncedCalculateState());
    this.subEntry('isImage', () => this._debouncedCalculateState());

    this._calculateState();
  }

  private _updateShowFileNames(value: boolean): void {
    const isListMode = this.cfg.filesViewMode === 'list';
    if (isListMode) {
      this._showFileNames = true;
      return;
    }

    this._showFileNames = value;
  }

  protected override willUpdate(changedProperties: PropertyValues<this>): void {
    super.willUpdate(changedProperties);

    if (changedProperties.has('uid')) {
      this._handleEntryId(this.uid);
    }
  }

  public override initCallback(): void {
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

    this.sub('*uploadTrigger', (itemsToUpload) => {
      if (this.entry && !itemsToUpload.has(this.entry.uid)) {
        return;
      }
      setTimeout(() => this.isConnected && this._upload());
    });
    FileItem.activeInstances.add(this);
  }

  public override connectedCallback(): void {
    super.connectedCallback();

    this._observer = new window.IntersectionObserver(this._observerCallback.bind(this), {
      threshold: [0, 1],
    });
    this._observer.observe(this);
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();

    this._observer?.disconnect();

    FileItem.activeInstances.delete(this);

    this.reset();
  }

  private _upload = this.withEntry(async (entry) => {
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

      if (entry === this.entry) {
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

      if (entry === this.entry) {
        this._debouncedCalculateState();
      }
    }
  });

  public static activeInstances: Set<FileItem> = new Set<FileItem>();

  protected override shouldUpdate(changedProperties: PropertyValues<this>): boolean {
    if (this._pauseRender) {
      return false;
    }
    return super.shouldUpdate(changedProperties);
  }

  public override render() {
    return html`
      <div class="uc-inner" ?finished=${this._isFinished} ?uploading=${this._isUploading} ?failed=${this._isFailed} ?focused=${this._isFocused}>
        <uc-thumb .uid=${this.uid} .badgeIcon=${this._badgeIcon}></uc-thumb>

        <div aria-atomic="true" aria-live="polite" class="uc-file-name-wrapper" aria-label=${this._ariaLabelStatusFile}>
          <span class="uc-file-name" ?hidden=${!this._showFileNames}>${this._itemName}</span>
          <span class="uc-file-error" ?hidden=${!this._errorText}>${this._errorText}</span>
          <span class="uc-file-hint" ?hidden=${!this._hint}>${this._hint}</span>
        </div>
        <div class="uc-file-actions">
          <button
            type="button"
            @click=${this._handleEdit}
            ?hidden=${!this._isEditable}
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
        <uc-progress-bar class="uc-progress-bar" .value=${this._progressValue} .visible=${this._progressVisible} ?hasFileName=${this._showFileNames}>
        </uc-progress-bar>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-file-item': FileItem;
  }
}
