import { shrinkFile } from '@uploadcare/image-shrink';
import {
  CancelError,
  type FileFromOptions,
  UploadcareError,
  type UploadcareFile,
  uploadFile,
} from '@uploadcare/upload-client';
import { ActivityBlock } from '../../abstract/ActivityBlock';
import type { UploadEntryTypedData } from '../../abstract/uploadEntrySchema';
import { debounce } from '../../utils/debounce';
import { parseShrink } from '../../utils/parseShrink';
import { throttle } from '../../utils/throttle';
import { ExternalUploadSource } from '../../utils/UploadSource';
import './file-item.css';
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

type BaseInitState = InstanceType<typeof FileItemConfig>['init$'];

interface FileItemInitState extends BaseInitState {
  uid: string;
  itemName: string;
  errorText: string;
  hint: string;
  thumbUrl: string;
  progressValue: number;
  progressVisible: boolean;
  badgeIcon: string;
  isFinished: boolean;
  isFailed: boolean;
  isUploading: boolean;
  isFocused: boolean;
  isEditable: boolean;
  showFileNames: boolean;
  state: FileItemStateValue;
  ariaLabelStatusFile: string;
  onEdit: () => void;
  onRemove: () => void;
  onUpload: () => void;
}

export class FileItem extends FileItemConfig {
  override couldBeCtxOwner = true;
  override pauseRender = true;

  private _renderedOnce = false;
  private _observer?: IntersectionObserver;
  protected _isIntersecting = false;
  protected _thumbRect?: DOMRectReadOnly;

  constructor() {
    super();

    this.init$ = {
      ...this.init$,
      uid: '',
      itemName: '',
      errorText: '',
      hint: '',
      thumbUrl: '',
      progressValue: 0,
      progressVisible: false,
      badgeIcon: '',
      isFinished: false,
      isFailed: false,
      isUploading: false,
      isFocused: false,
      isEditable: false,
      showFileNames: false,
      state: FileItemState.IDLE,
      ariaLabelStatusFile: '',
      onEdit: this._withEntry((entry) => {
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
        this.modalManager?.open(ActivityBlock.activities.CLOUD_IMG_EDIT);
        this.$['*currentActivity'] = ActivityBlock.activities.CLOUD_IMG_EDIT;
      }),
      onRemove: () => {
        this.telemetryManager.sendEvent({
          payload: {
            metadata: {
              event: 'remove-file',
              node: this.tagName,
            },
          },
        });
        this.uploadCollection.remove(this.$.uid);
      },
      onUpload: () => {
        this.upload();
      },
    } as FileItemInitState;
  }

  private _calculateState = this._withEntry((entry) => {
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

    this.$.state = state;
  });

  private _debouncedCalculateState = debounce(this._calculateState.bind(this), 100);

  private _updateHintAndProgress = this._withEntry(
    throttle((entry: UploadEntryTypedData, state?: FileItemStateValue) => {
      const errorText = entry.getValue('errors')?.[0]?.message;
      const source = entry.getValue('source');
      const externalUrl = entry.getValue('externalUrl');
      const isUploading = state === FileItemState.UPLOADING;
      const isQueuedForUploading = state === FileItemState.QUEUED_UPLOADING;
      const isQueuedForValidation = state === FileItemState.QUEUED_VALIDATION;
      const isValidationPending = state === FileItemState.VALIDATION;
      const fileName = entry.getValue('fileName');
      let hint = '';

      if (errorText) {
        hint = '';
      } else if (externalUrl && source && Object.values(ExternalUploadSource).includes(source)) {
        hint = this.l10n('waiting-for', { source: this.l10n(`src-type-${source}`) });
      }

      this.set$({
        hint,
        errorText,
        progressVisible: isUploading || isQueuedForUploading || isQueuedForValidation || isValidationPending,
        progressValue: isQueuedForValidation || isValidationPending ? 0 : entry.getValue('uploadProgress'),
        ariaLabelStatusFile:
          fileName &&
          this.l10n('a11y-file-item-status', {
            fileName,
            status: this.l10n(state?.description?.toLocaleLowerCase() ?? '').toLocaleLowerCase(),
          }),
      });
    }, 100),
  );

  private _handleState = this._withEntry((entry, state: FileItemStateValue) => {
    if (state === FileItemState.FAILED) {
      this.$.badgeIcon = 'badge-error';
    } else if (state === FileItemState.FINISHED) {
      this.$.badgeIcon = 'badge-success';
    }

    if (state === FileItemState.UPLOADING) {
      this.$.isFocused = false;
    }

    this.set$({
      isFailed: state === FileItemState.FAILED,
      isUploading: state === FileItemState.UPLOADING,
      isFinished: state === FileItemState.FINISHED,
      isEditable: this.cfg.useCloudImageEditor && entry.getValue('isImage') && entry.getValue('cdnUrl'),
    });

    this._updateHintAndProgress(state);
  });

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
      this.render();
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
      this.$.itemName = name || entry.getValue('externalUrl') || this.l10n('file-no-name');
      this._debouncedCalculateState();
    });

    this._subEntry('externalUrl', (externalUrl) => {
      this.$.itemName = entry.getValue('fileName') || externalUrl || this.l10n('file-no-name');
    });

    this._subEntry('fileInfo', () => {
      this._debouncedCalculateState();
    });

    this._subEntry('errors', () => this._debouncedCalculateState());
    this._subEntry('isUploading', () => this._debouncedCalculateState());
    this._subEntry('fileSize', () => this._debouncedCalculateState());
    this._subEntry('mimeType', () => this._debouncedCalculateState());
    this._subEntry('isImage', () => this._debouncedCalculateState());
  }

  private _updateShowFileNames(value: boolean): void {
    const isListMode = this.cfg.filesViewMode === 'list';
    if (isListMode) {
      this.$.showFileNames = true;
      return;
    }

    this.$.showFileNames = value;
  }

  override initCallback(): void {
    super.initCallback();

    this.sub('uid', (uid: string) => {
      this._handleEntryId(uid);
    });

    this.sub('state', (state: FileItemStateValue) => {
      this._handleState(state);
    });

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

  override destroyCallback(): void {
    super.destroyCallback();

    FileItem.activeInstances.delete(this);

    this._reset();
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
  }

  private _settingsOfShrink(): ReturnType<typeof parseShrink> {
    return parseShrink(this.cfg.imageShrink);
  }

  private async _processShrink(file: File): ReturnType<typeof shrinkFile> {
    const settings = this._settingsOfShrink();
    if (!settings) {
      console.warn('Image shrink settings are invalid, skipping shrinking');
      return file;
    }
    return await shrinkFile(file, settings);
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
            file = await this._processShrink(file);
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

  static override template = /* HTML */ `
  <div class="uc-inner" set="@finished: isFinished; @uploading: isUploading; @failed: isFailed; @focused: isFocused">
    <uc-thumb set="uid:uid;badgeIcon:badgeIcon"></uc-thumb>

    <div aria-atomic="true" aria-live="polite" class="uc-file-name-wrapper" set="@aria-label:ariaLabelStatusFile;">
      <span class="uc-file-name" set="@hidden: !showFileNames">{{itemName}}</span>
      <span class="uc-file-error" set="@hidden: !errorText;">{{errorText}}</span>
      <span class="uc-file-hint" set="@hidden: !hint">{{hint}}</span>
    </div>
    <div class="uc-file-actions">
      <button
        type="button"
        l10n="@title:file-item-edit-button;@aria-label:file-item-edit-button"
        class="uc-edit-btn uc-mini-btn"
        set="onclick: onEdit; @hidden: !isEditable"
      >
        <uc-icon name="edit-file"></uc-icon>
      </button>
      <button
        type="button"
        l10n="@title:file-item-remove-button;@aria-label:file-item-remove-button"
        class="uc-remove-btn uc-mini-btn"
        set="onclick: onRemove;"
      >
        <uc-icon name="remove-file"></uc-icon>
      </button>
      <button type="button" class="uc-upload-btn uc-mini-btn" set="onclick: onUpload;">
        <uc-icon name="upload"></uc-icon>
      </button>
    </div>
    <uc-progress-bar
      class="uc-progress-bar"
      set="value: progressValue; visible: progressVisible; @hasFileName: showFileNames;"
    >
    </uc-progress-bar>
  </div>
`;

  static activeInstances: Set<FileItem> = new Set<FileItem>();
}
