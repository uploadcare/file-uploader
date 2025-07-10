// @ts-check
import { shrinkFile } from '@uploadcare/image-shrink';
import { CancelError, UploadcareError, uploadFile } from '@uploadcare/upload-client';
import { ActivityBlock } from '../../abstract/ActivityBlock.js';
import { parseShrink } from '../../utils/parseShrink.js';
import { ExternalUploadSource } from '../utils/UploadSource.js';
import { debounce } from '../utils/debounce.js';
import { throttle } from '../utils/throttle.js';
import { FileItemConfig } from './FileItemConfig.js';

const FileItemState = Object.freeze({
  FINISHED: Symbol('FINISHED'),
  FAILED: Symbol('FAILED'),
  UPLOADING: Symbol('UPLOADING'),
  IDLE: Symbol('IDLE'),
});

export class FileItem extends FileItemConfig {
  couldBeCtxOwner = true;
  pauseRender = true;

  /** @private */
  _renderedOnce = false;

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
        this.$['*currentActivityParams'] = {
          internalId: entry.uid,
        };
        this.modalManager.open(ActivityBlock.activities.CLOUD_IMG_EDIT);
        this.$['*currentActivity'] = ActivityBlock.activities.CLOUD_IMG_EDIT;
      }),
      onRemove: () => {
        this.uploadCollection.remove(this.$.uid);
      },
      onUpload: () => {
        this.upload();
      },
    };
  }

  _reset() {
    super._reset();
    this._debouncedCalculateState.cancel();
  }

  /**
   * @private
   * @param {IntersectionObserverEntry[]} entries
   */
  _observerCallback(entries) {
    let [entry] = entries;

    this._isIntersecting = entry.isIntersecting;
    this._thumbRect = entry.boundingClientRect;

    if (entry.isIntersecting && !this._renderedOnce) {
      this.render();
      this._renderedOnce = true;
    }
  }

  /** @private */
  _calculateState = this._withEntry((entry) => {
    let state = FileItemState.IDLE;

    if (entry.getValue('errors').length > 0) {
      state = FileItemState.FAILED;
    } else if (entry.getValue('isUploading')) {
      state = FileItemState.UPLOADING;
    } else if (entry.getValue('fileInfo')) {
      state = FileItemState.FINISHED;
    }

    this.$.state = state;
  });

  /** @private */
  _debouncedCalculateState = debounce(this._calculateState.bind(this), 100);

  _updateHint = this._withEntry(
    throttle((entry) => {
      const source = entry.getValue('source');
      const externalUrl = entry.getValue('externalUrl');
      const noErrors = entry.getValue('errors').length === 0;
      const noProgress = this.$.progressValue === 0;
      const isUploading = this.$.state === FileItemState.UPLOADING;
      const isQueued = entry.getValue('isQueued');

      if (!noErrors || !isUploading || !noProgress) {
        this.$.hint = '';
        return;
      }

      if (isQueued) {
        const hint = this.l10n('queued');
        this.$.hint = hint;
        return;
      }

      if (externalUrl && source && Object.values(ExternalUploadSource).includes(source)) {
        const hint = this.l10n('waiting-for', { source: this.l10n(`src-type-${source}`) });
        this.$.hint = hint;
        return;
      }

      this.$.hint = '';
    }, 100),
  );

  /**
   * @private
   * @param {String} id
   */
  _handleEntryId(id) {
    this._reset();

    let entry = this.uploadCollection?.read(id);
    this._entry = entry;

    if (!entry) {
      return;
    }

    this._subEntry('uploadProgress', (uploadProgress) => {
      this.$.progressValue = uploadProgress;
      this._updateHint();
    });

    this._subEntry('isQueued', () => {
      this._updateHint();
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

  /** @param {boolean} value */
  _updateShowFileNames(value) {
    const isListMode = this.cfg.filesViewMode === 'list';
    if (isListMode) {
      this.$.showFileNames = true;
      return;
    }

    this.$.showFileNames = value;
  }

  initCallback() {
    super.initCallback();

    this.sub('uid', (uid) => {
      this._handleEntryId(uid);
    });

    this.sub('state', (state) => {
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

    this.sub(
      '*uploadTrigger',
      /** @param {Set<string>} itemsToUpload */
      (itemsToUpload) => {
        if (this._entry && !itemsToUpload.has(this._entry.uid)) {
          return;
        }
        setTimeout(() => this.isConnected && this.upload());
      },
    );
    FileItem.activeInstances.add(this);
  }

  _handleState = this._withEntry(
    /** @param {(typeof FileItemState)[keyof typeof FileItemState]} state */
    (entry, state) => {
      if (state === FileItemState.FAILED) {
        this.$.badgeIcon = 'badge-error';
      } else if (state === FileItemState.FINISHED) {
        this.$.badgeIcon = 'badge-success';
      }

      if (state === FileItemState.UPLOADING) {
        this.$.isFocused = false;
      }
      const fileName = entry.getValue('fileName');

      this.set$({
        isFailed: state === FileItemState.FAILED,
        isUploading: state === FileItemState.UPLOADING,
        isFinished: state === FileItemState.FINISHED,
        progressVisible: state === FileItemState.UPLOADING,
        isEditable: this.cfg.useCloudImageEditor && this._entry?.getValue('isImage') && this._entry?.getValue('cdnUrl'),
        errorText: entry.getValue('errors')?.[0]?.message,
        ariaLabelStatusFile:
          fileName &&
          this.l10n('a11y-file-item-status', {
            fileName,
            status: this.l10n(state?.description?.toLocaleLowerCase() ?? '').toLocaleLowerCase(),
          }),
      });

      this._updateHint();
    },
  );

  destroyCallback() {
    super.destroyCallback();

    FileItem.activeInstances.delete(this);

    this._reset();
  }

  connectedCallback() {
    super.connectedCallback();

    /** @private */
    this._observer = new window.IntersectionObserver(this._observerCallback.bind(this), {
      threshold: [0, 1],
    });
    this._observer.observe(this);
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    this._observer?.disconnect();
  }

  _settingsOfShrink() {
    return parseShrink(this.cfg.imageShrink);
  }

  /**
   * @private
   * @param {File} file
   */
  _processShrink(file) {
    return shrinkFile(file, this._settingsOfShrink());
  }

  upload = this._withEntry(async (entry) => {
    if (!this.uploadCollection.read(entry.uid)) {
      return;
    }

    if (entry.getValue('fileInfo') || entry.getValue('isUploading') || entry.getValue('errors').length > 0) {
      return;
    }
    const multipleMax = this.cfg.multiple ? this.cfg.multipleMax : 1;
    if (multipleMax && this.uploadCollection.size > multipleMax) {
      return;
    }

    this._debouncedCalculateState();

    entry.setMultipleValues({
      isUploading: true,
      errors: [],
      isQueued: true,
    });

    try {
      let abortController = new AbortController();
      entry.setValue('abortController', abortController);

      const uploadTask = async () => {
        entry.setValue('isQueued', false);
        /** @type {Blob | File | null} */
        let file = entry.getValue('file');
        if (file && this.cfg.imageShrink) {
          file = await this._processShrink(/** @type {File} */ (file)).catch(() => file);
        }

        const fileInput = file || entry.getValue('externalUrl') || entry.getValue('uuid');
        if (!fileInput) {
          throw new Error('No file input');
        }
        const baseUploadClientOptions = await this.getUploadClientOptions();
        /** @type {import('@uploadcare/upload-client').FileFromOptions} */
        const uploadClientOptions = {
          ...baseUploadClientOptions,
          fileName: entry.getValue('fileName') ?? undefined,
          source: entry.getValue('source') ?? undefined,
          onProgress: (progress) => {
            if (progress.isComputable) {
              let percentage = progress.value * 100;
              entry.setValue('uploadProgress', percentage);
            }
          },
          signal: abortController.signal,
          metadata: await this.getMetadataFor(entry.uid),
        };
        this.debugPrint('upload options', fileInput, uploadClientOptions);
        return uploadFile(fileInput, uploadClientOptions);
      };

      /** @type {import('@uploadcare/upload-client').UploadcareFile} */
      let fileInfo = await this.$['*uploadQueue'].add(uploadTask);
      entry.setMultipleValues({
        fileInfo,
        isQueued: false,
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
}

FileItem.template = /* HTML */ `
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
FileItem.activeInstances = new Set();
