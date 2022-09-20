import { UploaderBlock } from '../../abstract/UploaderBlock.js';
import { ActivityBlock } from '../../abstract/ActivityBlock.js';
import { resizeImage } from '../utils/resizeImage.js';
import { uploadFile } from '@uploadcare/upload-client';
import { UiMessage } from '../MessageBox/MessageBox.js';
import { fileCssBg } from '../svg-backgrounds/svg-backgrounds.js';
import { createCdnUrl, createCdnUrlModifiers, createOriginalUrl } from '../../utils/cdn-utils.js';
import { EVENT_TYPES, EventData, EventManager } from '../../abstract/EventManager.js';
import { debounce } from '../utils/debounce.js';

const FileItemState = {
  FINISHED: Symbol(0),
  FAILED: Symbol(1),
  UPLOADING: Symbol(2),
  IDLE: Symbol(3),
};

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
  _debouncedCalculateState = debounce(this._calculateState.bind(this), 0);
  /** @private */
  _renderedOnce = false;

  init$ = {
    ...this.ctxInit,
    uid: '',
    itemName: '',
    thumbUrl: '',
    progressValue: 0,
    progressVisible: false,
    progressUnknown: false,
    notImage: true,
    badgeIcon: '',
    isFinished: false,
    isFailed: false,
    isUploading: false,
    isFocused: false,
    state: FileItemState.IDLE,
    '*uploadTrigger': null,

    onEdit: () => {
      this.set$({
        '*focusedEntry': this._entry,
        '*currentActivity': ActivityBlock.activities.DETAILS,
      });
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
    let entry = this._entry;
    let state = FileItemState.IDLE;

    if (entry.getValue('uploadError') || entry.getValue('validationErrorMsg')) {
      state = FileItemState.FAILED;
    } else if (entry.getValue('isUploading')) {
      state = FileItemState.UPLOADING;
    } else if (entry.getValue('uuid')) {
      state = FileItemState.FINISHED;
    }

    if (this.$.state !== state) {
      this.$.state = state;
    }
  }

  /** @private */
  async _generateThumbnail() {
    let entry = this._entry;

    if (entry.getValue('uuid') && entry.getValue('isImage')) {
      let size = this.getCssData('--cfg-thumb-size') || 76;
      let thumbUrl = this.proxyUrl(
        createCdnUrl(
          createOriginalUrl(this.getCssData('--cfg-cdn-cname'), this._entry.getValue('uuid')),
          createCdnUrlModifiers(entry.getValue('cdnUrlModifiers'), `scale_crop/${size}x${size}/center`)
        )
      );
      let blobSrc = entry.getValue('thumbUrl');
      entry.setValue('thumbUrl', thumbUrl);
      URL.revokeObjectURL(blobSrc);
      return;
    }

    if (entry.getValue('thumbUrl')) {
      return;
    }

    if (entry.getValue('file')?.type.includes('image')) {
      let thumbUrl = await resizeImage(entry.getValue('file'), this.getCssData('--cfg-thumb-size') || 76);
      entry.setValue('thumbUrl', thumbUrl);
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

  _subEntry(prop, handler) {
    let sub = this._entry.subscribe(prop, handler);
    this._entrySubs.add(sub);
  }

  /** @param {String} id */
  _handleEntryId(id) {
    this._reset();

    /** @type {import('../../abstract/TypedData.js').TypedData} */
    this._entry = this.uploadCollection?.read(id);

    if (!this._entry) {
      return;
    }

    this._subEntry('validationErrorMsg', (validationErrorMsg) => {
      this._debouncedCalculateState();
      if (!validationErrorMsg) {
        return;
      }
      let caption =
        this.l10n('validation-error') +
        ': ' +
        (this._entry.getValue('file')?.name || this._entry.vetValue('externalUrl'));
      this._showMessage('error', caption, validationErrorMsg);
    });

    this._subEntry('uploadError', (uploadError) => {
      this._debouncedCalculateState();
      if (!uploadError) {
        return;
      }
      let caption =
        this.l10n('upload-error') + ': ' + (this._entry.getValue('file')?.name || this._entry.vetValue('externalUrl'));
      this._showMessage('error', caption, uploadError.message);
    });

    this._subEntry('isUploading', () => {
      this._debouncedCalculateState();
    });

    this._subEntry('uploadProgress', (uploadProgress) => {
      this.$.progressValue = uploadProgress;
    });

    this._subEntry('fileName', (name) => {
      this.$.itemName = name || this._entry.vetValue('externalUrl') || this.l10n('file-no-name');
    });

    this._subEntry('fileSize', (fileSize) => {
      let maxFileSize = this.getCssData('--cfg-max-local-file-size-bytes');
      if (!maxFileSize) {
        return;
      }
      if (fileSize && fileSize > maxFileSize) {
        this._entry.setValue('validationErrorMsg', this.l10n('files-max-size-limit-error', { maxFileSize }));
      }
    });

    this._subEntry('externalUrl', (externalUrl) => {
      this.$.itemName = this._entry.getValue('fileName') || externalUrl || this.l10n('file-no-name');
    });

    this._subEntry('uuid', (uuid) => {
      this._debouncedCalculateState();
      if (uuid) {
        this._debouncedGenerateThumb();
      }
    });

    this._subEntry('cdnUrlModifiers', () => {
      this._debouncedGenerateThumb();
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
      this.set$({
        isFailed: state === FileItemState.FAILED,
        isUploading: state === FileItemState.UPLOADING,
        isFinished: state === FileItemState.FINISHED,
        progressVisible: state === FileItemState.UPLOADING,
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

  destroyCallback() {
    super.destroyCallback();

    this._debouncedGenerateThumb.cancel();
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

    this._observer?.disconnect();
  }

  async upload() {
    let entry = this._entry;
    if (entry.getValue('uuid') || entry.getValue('isUploading')) {
      return;
    }
    let data = this.getOutputData((dataItem) => {
      return !dataItem.getValue('uuid');
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

      let fileInfo = await uploadFile(entry.getValue('file') || entry.getValue('externalUrl'), {
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
      if (entry === this._entry) {
        this._debouncedCalculateState();
      }
      entry.setMultipleValues({
        fileInfo,
        isUploading: false,
        fileName: fileInfo.name,
        fileSize: fileInfo.size,
        isImage: fileInfo.isImage,
        mimeType: fileInfo.mimeType,
        uuid: fileInfo.uuid,
        cdnUrl: fileInfo.cdnUrl,
      });
    } catch (error) {
      entry.setValue('abortController', null);
      entry.setValue('isUploading', false);
      entry.setValue('uploadProgress', 0);

      if (entry === this._entry) {
        this._debouncedCalculateState();
      }

      if (!error?.isCancel) {
        entry.setValue('uploadError', error);
      }
    }
  }
}

FileItem.template = /*html*/ `
<div
  class="inner"
  set="@finished: isFinished; @uploading: isUploading; @failed: isFailed; @focused: isFocused">
  <div
    class="thumb"
    set="style.backgroundImage: thumbUrl">
    <div class="badge">
      <lr-icon set="@name: badgeIcon"></lr-icon>
    </div>
  </div>
  <div class="file-name-wrapper">
    <span class="file-name" set="@title: itemName">{{itemName}}</span>
  </div>
  <button type="button" class="edit-btn" set="onclick: onEdit;">
    <lr-icon name="edit-file"></lr-icon>
  </button>
  <button type="button" class="remove-btn" set="onclick: onRemove;">
    <lr-icon name="remove-file"></lr-icon>
  </button>
  <button type="button" class="upload-btn" set="onclick: onUpload;">
    <lr-icon name="upload"></lr-icon>
  </button>
  <lr-progress-bar
    class="progress-bar"
    set="value: progressValue; visible: progressVisible; unknown: progressUnknown">
  </lr-progress-bar>
</div>
`;
FileItem.activeInstances = new Set();
