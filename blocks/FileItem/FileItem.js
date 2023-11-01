// @ts-check
import { UploadClientError, uploadFile } from '@uploadcare/upload-client';
import { ActivityBlock } from '../../abstract/ActivityBlock.js';
import { UploaderBlock } from '../../abstract/UploaderBlock.js';
import { createCdnUrl, createCdnUrlModifiers, createOriginalUrl } from '../../utils/cdn-utils.js';
import { EventType } from '../UploadCtxProvider/EventEmitter.js';
import { fileCssBg } from '../svg-backgrounds/svg-backgrounds.js';
import { debounce } from '../utils/debounce.js';
import { generateThumb } from '../utils/resizeImage.js';

const FileItemState = Object.freeze({
  FINISHED: Symbol(0),
  FAILED: Symbol(1),
  UPLOADING: Symbol(2),
  IDLE: Symbol(3),
  LIMIT_OVERFLOW: Symbol(4),
});

export class FileItem extends UploaderBlock {
  pauseRender = true;

  /** @private */
  _entrySubs = new Set();
  /**
   * @private
   * @type {any} TODO: Add types for upload entry
   */
  _entry = null;
  /** @private */
  _isIntersecting = false;
  /** @private */
  _debouncedGenerateThumb = debounce(this._generateThumbnail.bind(this), 100);
  /** @private */
  _debouncedCalculateState = debounce(this._calculateState.bind(this), 100); // TODO: better throttle

  /** @private */
  _renderedOnce = false;

  constructor() {
    super();

    this.init$ = {
      ...this.init$,
      uid: '',
      itemName: '',
      errorText: '',
      thumbUrl: '',
      progressValue: 0,
      progressVisible: false,
      progressUnknown: false,
      badgeIcon: '',
      isFinished: false,
      isFailed: false,
      isUploading: false,
      isFocused: false,
      isEditable: false,
      isLimitOverflow: false,
      state: FileItemState.IDLE,
      '*uploadTrigger': null,

      onEdit: () => {
        this.set$({
          '*focusedEntry': this._entry,
        });
        if (this.hasBlockInCtx((b) => b.activityType === ActivityBlock.activities.DETAILS)) {
          this.$['*currentActivity'] = ActivityBlock.activities.DETAILS;
        } else {
          this.$['*currentActivity'] = ActivityBlock.activities.CLOUD_IMG_EDIT;
        }
      },
      onRemove: () => {
        let entryUuid = this._entry.getValue('uuid');
        if (entryUuid) {
          let data = this.getOutputData((dataItem) => {
            return dataItem.getValue('uuid') === entryUuid;
          });
          this.emit(EventType.REMOVE, data, { debounce: true });
        }
        this.uploadCollection.remove(this.$.uid);
      },
      onUpload: () => {
        this.upload();
      },
    };
  }

  _reset() {
    for (let sub of this._entrySubs) {
      sub.remove();
    }

    this._debouncedGenerateThumb.cancel();
    this._debouncedCalculateState.cancel();
    this._entrySubs = new Set();
    this._entry = null;
  }

  /**
   * @private
   * @param {IntersectionObserverEntry[]} entries
   */
  _observerCallback(entries) {
    let [entry] = entries;
    this._isIntersecting = entry.isIntersecting;

    if (entry.isIntersecting && !this._renderedOnce) {
      this.render();
      this._renderedOnce = true;
    }
    if (entry.intersectionRatio === 0) {
      this._debouncedGenerateThumb.cancel();
    } else {
      this._debouncedGenerateThumb();
    }
  }

  /** @private */
  _calculateState() {
    if (!this._entry) {
      return;
    }
    let entry = this._entry;
    let state = FileItemState.IDLE;

    if (entry.getValue('uploadError') || entry.getValue('validationErrorMsg')) {
      state = FileItemState.FAILED;
    } else if (entry.getValue('validationMultipleLimitMsg')) {
      state = FileItemState.LIMIT_OVERFLOW;
    } else if (entry.getValue('isUploading')) {
      state = FileItemState.UPLOADING;
    } else if (entry.getValue('fileInfo')) {
      state = FileItemState.FINISHED;
    }

    this.$.state = state;
  }

  /** @private */
  async _generateThumbnail() {
    if (!this._entry) {
      return;
    }
    let entry = this._entry;

    if (entry.getValue('fileInfo') && entry.getValue('isImage')) {
      let size = this.cfg.thumbSize;
      let thumbUrl = this.proxyUrl(
        createCdnUrl(
          createOriginalUrl(this.cfg.cdnCname, this._entry.getValue('uuid')),
          createCdnUrlModifiers(entry.getValue('cdnUrlModifiers'), `scale_crop/${size}x${size}/center`)
        )
      );
      let currentThumbUrl = entry.getValue('thumbUrl');
      if (currentThumbUrl !== thumbUrl) {
        entry.setValue('thumbUrl', thumbUrl);
        currentThumbUrl?.startsWith('blob:') && URL.revokeObjectURL(currentThumbUrl);
      }
      return;
    }

    if (entry.getValue('thumbUrl')) {
      return;
    }

    if (entry.getValue('file')?.type.includes('image')) {
      try {
        let thumbUrl = await generateThumb(entry.getValue('file'), this.cfg.thumbSize);
        entry.setValue('thumbUrl', thumbUrl);
      } catch (err) {
        let color = window.getComputedStyle(this).getPropertyValue('--clr-generic-file-icon');
        entry.setValue('thumbUrl', fileCssBg(color));
      }
    } else {
      let color = window.getComputedStyle(this).getPropertyValue('--clr-generic-file-icon');
      entry.setValue('thumbUrl', fileCssBg(color));
    }
  }

  /**
   * @private
   * @param {string} prop
   * @param {(value: any) => void} handler
   */
  _subEntry(prop, handler) {
    let sub = this._entry.subscribe(
      prop,
      /** @param {any} value */ (value) => {
        if (this.isConnected) {
          handler(value);
        }
      }
    );
    this._entrySubs.add(sub);
  }

  /**
   * @private
   * @param {String} id
   */
  _handleEntryId(id) {
    this._reset();

    /** @type {import('../../abstract/TypedData.js').TypedData} */
    let entry = this.uploadCollection?.read(id);
    this._entry = entry;

    if (!entry) {
      return;
    }

    this._subEntry('uploadProgress', (uploadProgress) => {
      this.$.progressValue = uploadProgress;
    });

    this._subEntry('fileName', (name) => {
      this.$.itemName = name || entry.getValue('externalUrl') || this.l10n('file-no-name');
      this._debouncedCalculateState();
    });

    this._subEntry('externalUrl', (externalUrl) => {
      this.$.itemName = entry.getValue('fileName') || externalUrl || this.l10n('file-no-name');
    });

    this._subEntry('uuid', (uuid) => {
      this._debouncedCalculateState();
      if (uuid && this._isIntersecting) {
        this._debouncedGenerateThumb();
      }
    });

    this._subEntry('cdnUrlModifiers', () => {
      if (this._isIntersecting) {
        this._debouncedGenerateThumb();
      }
    });

    this._subEntry('thumbUrl', (thumbUrl) => {
      this.$.thumbUrl = thumbUrl ? `url(${thumbUrl})` : '';
    });

    this._subEntry('validationMultipleLimitMsg', () => this._debouncedCalculateState());
    this._subEntry('validationErrorMsg', () => this._debouncedCalculateState());
    this._subEntry('uploadError', () => this._debouncedCalculateState());
    this._subEntry('isUploading', () => this._debouncedCalculateState());
    this._subEntry('fileSize', () => this._debouncedCalculateState());
    this._subEntry('mimeType', () => this._debouncedCalculateState());
    this._subEntry('isImage', () => this._debouncedCalculateState());

    if (this._isIntersecting) {
      this._debouncedGenerateThumb();
    }
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

    this.onclick = () => {
      FileItem.activeInstances.forEach((inst) => {
        if (inst === this) {
          inst.setAttribute('focused', '');
        } else {
          inst.removeAttribute('focused');
        }
      });
    };

    this.$['*uploadTrigger'] = null;

    this.sub('*uploadTrigger', (val) => {
      if (!val) {
        return;
      }
      setTimeout(() => this.isConnected && this.upload());
    });
    FileItem.activeInstances.add(this);
  }

  /** @param {(typeof FileItemState)[keyof typeof FileItemState]} state */
  _handleState(state) {
    this.set$({
      isFailed: state === FileItemState.FAILED,
      isLimitOverflow: state === FileItemState.LIMIT_OVERFLOW,
      isUploading: state === FileItemState.UPLOADING,
      isFinished: state === FileItemState.FINISHED,
      progressVisible: state === FileItemState.UPLOADING,
      isEditable: this.cfg.useCloudImageEditor && this._entry?.getValue('isImage') && this._entry?.getValue('cdnUrl'),
      errorText:
        this._entry.getValue('uploadError')?.message ||
        this._entry.getValue('validationErrorMsg') ||
        this._entry.getValue('validationMultipleLimitMsg'),
    });

    if (state === FileItemState.FAILED || state === FileItemState.LIMIT_OVERFLOW) {
      this.$.badgeIcon = 'badge-error';
    } else if (state === FileItemState.FINISHED) {
      this.$.badgeIcon = 'badge-success';
    }

    if (state === FileItemState.UPLOADING) {
      this.$.isFocused = false;
    } else {
      this.$.progressValue = 0;
    }
  }

  destroyCallback() {
    super.destroyCallback();

    FileItem.activeInstances.delete(this);

    this._reset();
  }

  connectedCallback() {
    super.connectedCallback();

    /** @private */
    this._observer = new window.IntersectionObserver(this._observerCallback.bind(this), {
      root: this.parentElement,
      rootMargin: '50% 0px 50% 0px',
      threshold: [0, 1],
    });
    this._observer.observe(this);
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    this._debouncedGenerateThumb.cancel();
    this._observer?.disconnect();
  }

  async upload() {
    let entry = this._entry;

    if (!this.uploadCollection.read(entry.uid)) {
      return;
    }

    if (
      entry.getValue('fileInfo') ||
      entry.getValue('isUploading') ||
      entry.getValue('uploadError') ||
      entry.getValue('validationErrorMsg') ||
      entry.getValue('validationMultipleLimitMsg')
    ) {
      return;
    }
    const multipleMax = this.cfg.multiple ? this.cfg.multipleMax : 1;
    if (multipleMax && this.uploadCollection.size > multipleMax) {
      return;
    }
    let data = this.getOutputData((dataItem) => {
      return !dataItem.getValue('fileInfo');
    });

    this.emit(EventType.UPLOAD_START, data, { debounce: true });

    this._debouncedCalculateState();
    entry.setValue('isUploading', true);
    entry.setValue('uploadError', null);
    entry.setValue('validationErrorMsg', null);
    entry.setValue('validationMultipleLimitMsg', null);

    if (!entry.getValue('file') && entry.getValue('externalUrl')) {
      this.$.progressUnknown = true;
    }
    try {
      let abortController = new AbortController();
      entry.setValue('abortController', abortController);

      const uploadTask = async () => {
        const uploadClientOptions = this.getUploadClientOptions();
        return uploadFile(entry.getValue('file') || entry.getValue('externalUrl') || entry.getValue('uuid'), {
          ...uploadClientOptions,
          fileName: entry.getValue('fileName'),
          source: entry.getValue('source'),
          onProgress: (progress) => {
            if (progress.isComputable) {
              let percentage = progress.value * 100;
              entry.setValue('uploadProgress', percentage);
            }
            this.$.progressUnknown = !progress.isComputable;
          },
          signal: abortController.signal,
          metadata: await this.getMetadataFor(entry.uid),
        });
      };

      let fileInfo = await this.$['*uploadQueue'].add(uploadTask);
      entry.setMultipleValues({
        fileInfo,
        isUploading: false,
        fileName: fileInfo.originalFilename,
        fileSize: fileInfo.size,
        isImage: fileInfo.isImage,
        mimeType: fileInfo.contentInfo?.mime?.mime ?? fileInfo.mimeType,
        uuid: fileInfo.uuid,
        cdnUrl: fileInfo.cdnUrl,
      });

      if (entry === this._entry) {
        this._debouncedCalculateState();
      }
    } catch (error) {
      console.warn('Upload error', error);

      entry.setMultipleValues({
        abortController: null,
        isUploading: false,
        uploadProgress: 0,
      });

      if (entry === this._entry) {
        this._debouncedCalculateState();
      }

      if (error instanceof UploadClientError) {
        if (!error.isCancel) {
          entry.setValue('uploadError', error);
        }
      } else {
        entry.setValue('uploadError', new Error('Unexpected error'));
      }
    }
  }
}

FileItem.template = /* HTML */ `
  <div
    class="inner"
    set="@finished: isFinished; @uploading: isUploading; @failed: isFailed; @limit-overflow: isLimitOverflow; @focused: isFocused"
  >
    <div class="thumb" set="style.backgroundImage: thumbUrl">
      <div class="badge">
        <lr-icon set="@name: badgeIcon"></lr-icon>
      </div>
    </div>
    <div class="file-name-wrapper">
      <span class="file-name" set="@title: itemName">{{itemName}}</span>
      <span class="file-error" set="@hidden: !errorText">{{errorText}}</span>
    </div>
    <div class="file-actions">
      <button type="button" class="edit-btn mini-btn" set="onclick: onEdit; @hidden: !isEditable">
        <lr-icon name="edit-file"></lr-icon>
      </button>
      <button type="button" class="remove-btn mini-btn" set="onclick: onRemove;">
        <lr-icon name="remove-file"></lr-icon>
      </button>
      <button type="button" class="upload-btn mini-btn" set="onclick: onUpload;">
        <lr-icon name="upload"></lr-icon>
      </button>
    </div>
    <lr-progress-bar
      class="progress-bar"
      set="value: progressValue; visible: progressVisible; unknown: progressUnknown"
    >
    </lr-progress-bar>
  </div>
`;
FileItem.activeInstances = new Set();
