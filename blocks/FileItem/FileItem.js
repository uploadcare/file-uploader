import { UploaderBlock } from '../../abstract/UploaderBlock.js';
import { ActivityBlock } from '../../abstract/ActivityBlock.js';
import { generateThumb } from '../utils/resizeImage.js';
import { uploadFile } from '@uploadcare/upload-client';
import { UiMessage } from '../MessageBox/MessageBox.js';
import { fileCssBg } from '../svg-backgrounds/svg-backgrounds.js';
import { createCdnUrl, createCdnUrlModifiers, createOriginalUrl } from '../../utils/cdn-utils.js';
import { EVENT_TYPES, EventData, EventManager } from '../../abstract/EventManager.js';
import { debounce } from '../utils/debounce.js';
import { IMAGE_ACCEPT_LIST, mergeFileTypes, matchMimeType, matchExtension } from '../../utils/fileTypes.js';

const FileItemState = Object.freeze({
  FINISHED: Symbol(0),
  FAILED: Symbol(1),
  UPLOADING: Symbol(2),
  IDLE: Symbol(3),
});

export class FileItem extends UploaderBlock {
  pauseRender = true;

  /** @private */
  _entrySubs = new Set();
  /** @private */
  _entry = null;
  /** @private */
  _isIntersecting = false;
  /** @private */
  _debouncedGenerateThumb = debounce(this._generateThumbnail.bind(this), 100);
  /** @private */
  _debouncedCalculateState = debounce(this._calculateState.bind(this), 100); // TODO: better throttle
  /** @private */
  _renderedOnce = false;

  cssInit$ = {
    ...this.cssInit$,
    '--cfg-use-cloud-image-editor': 0,
  };

  init$ = {
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
    state: FileItemState.IDLE,
    '*uploadTrigger': null,

    onEdit: () => {
      this.set$({
        '*focusedEntry': this._entry,
      });
      if (this.findBlockInCtx((b) => b.activityType === ActivityBlock.activities.DETAILS)) {
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
        EventManager.emit(
          new EventData({
            type: EVENT_TYPES.REMOVE,
            ctx: this.ctxName,
            data,
          })
        );
      }
      this.uploadCollection.remove(this.$.uid);
    },
    onUpload: () => {
      this.upload();
    },
  };

  _reset() {
    for (let sub of this._entrySubs) {
      sub.remove();
    }

    this._debouncedGenerateThumb.cancel();
    this._entrySubs = new Set();
    this._entry = null;
    this._isIntersecting = false;
  }

  /** @private */
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
    } else if (entry.getValue('isUploading')) {
      state = FileItemState.UPLOADING;
    } else if (entry.getValue('fileInfo')) {
      state = FileItemState.FINISHED;
    }

    if (this.$.state !== state) {
      this.$.state = state;
    }
  }

  /** @private */
  async _generateThumbnail() {
    if (!this._entry) {
      return;
    }
    let entry = this._entry;

    if (entry.getValue('fileInfo') && entry.getValue('isImage')) {
      let size = this.getCssData('--cfg-thumb-size') || 76;
      let thumbUrl = this.proxyUrl(
        createCdnUrl(
          createOriginalUrl(this.getCssData('--cfg-cdn-cname'), this._entry.getValue('uuid')),
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
        let thumbUrl = await generateThumb(entry.getValue('file'), this.getCssData('--cfg-thumb-size') || 76);
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
   * @param {'success' | 'error'} type
   * @param {String} caption
   * @param {String} text
   */
  _showMessage(type, caption, text) {
    let msg = new UiMessage();
    msg.caption = caption;
    msg.text = text;
    msg.isError = type === 'error';
    this.set$({
      badgeIcon: `badge-${type}`,
      '*message': msg,
    });
  }

  /**
   * @private
   * @param {string} prop
   * @param {(value: any) => void} handler
   */
  _subEntry(prop, handler) {
    let sub = this._entry.subscribe(prop, (value) => {
      if (this.isConnected) {
        handler(value);
      }
    });
    this._entrySubs.add(sub);
  }

  /**
   * @private
   * @param {import('../../abstract/TypedData.js').TypedData} entry
   */
  _validateFileType(entry) {
    const imagesOnly = this.getCssData('--cfg-img-only');
    const accept = this.getCssData('--cfg-accept');
    const allowedFileTypes = mergeFileTypes([...(imagesOnly ? IMAGE_ACCEPT_LIST : []), accept]);
    if (!allowedFileTypes.length) return;

    const mimeType = entry.getValue('mimeType');
    const fileName = entry.getValue('fileName');

    const needMimeCheck = !!mimeType;
    const needExtCheck = !!fileName;
    const mimeOk = needMimeCheck ? matchMimeType(mimeType, allowedFileTypes) : true;
    const extOk = needExtCheck ? matchExtension(fileName, allowedFileTypes) : true;

    if (!mimeOk && !extOk) {
      // Assume file type is not allowed if both mime and ext checks fail
      entry.setValue('validationErrorMsg', this.l10n('file-type-not-allowed'));
    }
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

    this._subEntry('validationErrorMsg', (validationErrorMsg) => {
      this._debouncedCalculateState();
      this.$.errorText = validationErrorMsg;
    });

    this._subEntry('uploadError', (uploadError) => {
      this._debouncedCalculateState();
      this.$.errorText = uploadError?.message;
    });

    this._subEntry('isUploading', () => {
      this._debouncedCalculateState();
    });

    this._subEntry('uploadProgress', (uploadProgress) => {
      this.$.progressValue = uploadProgress;
    });

    this._subEntry('fileName', (name) => {
      this.$.itemName = name || entry.getValue('externalUrl') || this.l10n('file-no-name');
      if (name) {
        this._validateFileType(entry);
      }
    });

    this._subEntry('fileSize', (fileSize) => {
      let maxFileSize = this.getCssData('--cfg-max-local-file-size-bytes');
      if (maxFileSize && fileSize && fileSize > maxFileSize) {
        entry.setValue('validationErrorMsg', this.l10n('files-max-size-limit-error', { maxFileSize }));
      }
    });

    this._subEntry('mimeType', (mimeType) => {
      if (mimeType) {
        this._validateFileType(entry);
      }
    });

    this._subEntry('isImage', (isImage) => {
      const imagesOnly = this.getCssData('--cfg-img-only');
      if (!imagesOnly || isImage) {
        return;
      }
      if (!entry.getValue('fileInfo') && entry.getValue('externalUrl')) {
        // skip validation for not uploaded files with external url, cause we don't know if they're images or not
        return;
      }
      if (!entry.getValue('fileInfo') && !entry.getValue('mimeType')) {
        // skip validation for not uploaded files without mime-type, cause we don't know if they're images or not
        return;
      }
      entry.setValue('validationErrorMsg', this.l10n('images-only-accepted'));
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

    if (!this.getCssData('--cfg-confirm-upload')) {
      this.upload();
    }

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

    this.sub('--cfg-use-cloud-image-editor', () => {
      this._handleState(this.$.state);
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

    this.$['*uploadTrigger'] = null;

    this.sub('*uploadTrigger', (val) => {
      if (!val || !this.isConnected) {
        return;
      }
      this.upload();
    });
    FileItem.activeInstances.add(this);
  }

  /** @param {(typeof FileItemState)[keyof typeof FileItemState]} state */
  _handleState(state) {
    this.set$({
      isFailed: state === FileItemState.FAILED,
      isUploading: state === FileItemState.UPLOADING,
      isFinished: state === FileItemState.FINISHED,
      progressVisible: state === FileItemState.UPLOADING,
      isEditable:
        this.$['--cfg-use-cloud-image-editor'] && state === FileItemState.FINISHED && this._entry?.getValue('isImage'),
    });

    if (state === FileItemState.FAILED) {
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
    if (entry.getValue('fileInfo') || entry.getValue('isUploading') || entry.getValue('validationErrorMsg')) {
      return;
    }
    let data = this.getOutputData((dataItem) => {
      return !dataItem.getValue('fileInfo');
    });
    EventManager.emit(
      new EventData({
        type: EVENT_TYPES.UPLOAD_START,
        ctx: this.ctxName,
        data,
      })
    );

    this._debouncedCalculateState();
    entry.setValue('isUploading', true);
    entry.setValue('uploadError', null);
    entry.setValue('validationErrorMsg', null);

    if (!entry.getValue('file') && entry.getValue('externalUrl')) {
      this.$.progressUnknown = true;
    }
    try {
      let abortController = new AbortController();
      entry.setValue('abortController', abortController);

      const uploadTask = () =>
        uploadFile(entry.getValue('file') || entry.getValue('externalUrl') || entry.getValue('uuid'), {
          ...this.getUploadClientOptions(),
          fileName: entry.getValue('fileName'),
          onProgress: (progress) => {
            if (progress.isComputable) {
              let percentage = progress.value * 100;
              entry.setValue('uploadProgress', percentage);
            }
            this.$.progressUnknown = !progress.isComputable;
          },
          signal: abortController.signal,
        });

      let fileInfo = await this.$['*uploadQueue'].add(uploadTask);
      entry.setMultipleValues({
        fileInfo,
        isUploading: false,
        fileName: fileInfo.originalFilename,
        fileSize: fileInfo.size,
        isImage: fileInfo.isImage,
        mimeType: fileInfo.mimeType,
        uuid: fileInfo.uuid,
        cdnUrl: fileInfo.cdnUrl,
      });

      if (entry === this._entry) {
        this._debouncedCalculateState();
      }
    } catch (error) {
      entry.setMultipleValues({
        abortController: null,
        isUploading: false,
        uploadProgress: 0,
      });

      if (entry === this._entry) {
        this._debouncedCalculateState();
      }

      if (!error?.isCancel) {
        entry.setValue('uploadError', error);
      }
    }
  }
}

FileItem.template = /* HTML */ `
  <div class="inner" set="@finished: isFinished; @uploading: isUploading; @failed: isFailed; @focused: isFocused">
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
