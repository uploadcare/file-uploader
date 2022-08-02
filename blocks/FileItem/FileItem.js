import { UploaderBlock } from '../../abstract/UploaderBlock.js';
import { ActivityBlock } from '../../abstract/ActivityBlock.js';
import { resizeImage } from '../utils/resizeImage.js';
import { uploadFile } from '@uploadcare/upload-client';
import { UiMessage } from '../MessageBox/MessageBox.js';
import { fileCssBg } from '../svg-backgrounds/svg-backgrounds.js';
import { createCdnUrl, createCdnUrlModifiers, createOriginalUrl } from '../../utils/cdn-utils.js';

export class FileItem extends UploaderBlock {
  pauseRender = true;

  init$ = {
    ...this.init$,
    uid: '',
    itemName: '',
    thumb: '',
    thumbUrl: '',
    progressValue: 0,
    progressVisible: false,
    progressUnknown: false,
    notImage: true,
    badgeIcon: 'check',
    '*uploadTrigger': null,

    onEdit: () => {
      this.set$({
        '*focusedEntry': this.entry,
        '*currentActivity': ActivityBlock.activities.DETAILS,
      });
    },
    onRemove: () => {
      this.uploadCollection.remove(this.uid);
    },
    onUpload: () => {
      this.upload();
    },
  };

  /** @private */
  _observerCallback(entries) {
    let [entry] = entries;
    if (entry.isIntersecting && !this.innerHTML) {
      this.render();
    }
    if (entry.intersectionRatio === 0) {
      clearTimeout(this._thumbTimeoutId);
      /** @private */
      this._thumbTimeoutId = undefined;
    } else if (!this._thumbTimeoutId) {
      /** @private */
      this._thumbTimeoutId = window.setTimeout(() => this._generateThumbnail(), 100);
    }
  }

  /** @private */
  _generateThumbnail() {
    if (this.$.thumbUrl) {
      return;
    }
    if (this.file?.type.includes('image')) {
      resizeImage(this.file, this.getCssData('--cfg-thumb-size') || 76).then((url) => {
        this.$.thumbUrl = `url(${url})`;
      });
    } else {
      let color = window.getComputedStyle(this).getPropertyValue('--clr-generic-file-icon');
      this.$.thumbUrl = `url(${fileCssBg(color)})`;
    }
  }

  /** @private */
  _revokeThumbUrl() {
    if (this.$.thumbUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(this.$.thumbUrl);
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

  initCallback() {
    super.initCallback();

    this.sub('uid', (id) => {
      if (!id || id === this.uid) {
        return;
      }
      /** @type {String} */
      this.uid = id;

      /** @type {import('../../abstract/TypedData.js').TypedData} */
      this.entry = this.uploadCollection?.read(id);

      if (!this.entry) {
        return;
      }

      this.entry.subscribe('validationErrorMsg', (validationErrorMsg) => {
        if (!validationErrorMsg) {
          return;
        }
        this.setAttribute('error', '');
        let caption = this.l10n('validation-error') + ': ' + (this.file?.name || this.externalUrl);
        this._showMessage('error', caption, validationErrorMsg);
      });

      this.entry.subscribe('uploadErrorMsg', (uploadError) => {
        if (!uploadError) {
          return;
        }
        let caption = this.l10n('upload-error') + ': ' + (this.file?.name || this.externalUrl);
        this._showMessage('error', caption, uploadError);
      });

      this.entry.subscribe('isUploading', (isUploading) => {
        this.$.progressVisible = isUploading;
      });

      this.entry.subscribe('uploadProgress', (uploadProgress) => {
        this.$.progressValue = uploadProgress;
      });

      this.entry.subscribe('fileName', (name) => {
        this.$.itemName = name || this.externalUrl || this.l10n('file-no-name');
      });

      this.entry.subscribe('fileSize', (fileSize) => {
        let maxFileSize = this.getCssData('--cfg-max-local-file-size-bytes');
        if (!maxFileSize) {
          return;
        }
        if (fileSize && fileSize > maxFileSize) {
          this.entry.setValue('validationErrorMsg', this.l10n('files-max-size-limit-error', { maxFileSize }));
        }
      });

      this.entry.subscribe('externalUrl', (externalUrl) => {
        this.$.itemName = this.entry.getValue('fileName') || externalUrl || this.l10n('file-no-name');
      });

      this.entry.subscribe('uuid', (uuid) => {
        if (!uuid) {
          return;
        }
        this._observer.unobserve(this);
        this.setAttribute('loaded', '');

        if (this.entry.getValue('isImage')) {
          this._revokeThumbUrl();
          let size = this.getCssData('--cfg-thumb-size') || 76;
          let thumbUrl = this.proxyUrl(
            createCdnUrl(
              createOriginalUrl(this.getCssData('--cfg-cdn-cname'), uuid),
              createCdnUrlModifiers(`scale_crop/${size}x${size}/center`)
            )
          );
          this.$.thumbUrl = `url(${thumbUrl})`;
        }
      });

      this.entry.subscribe('cdnUrl', (cdnUrl) => {
        if (!cdnUrl) {
          return;
        }
        if (this.entry.getValue('isImage')) {
          this._revokeThumbUrl();
          let size = this.getCssData('--cfg-thumb-size') || 76;
          let thumbUrl = this.proxyUrl(
            createCdnUrl(cdnUrl, createCdnUrlModifiers(`scale_crop/${size}x${size}/center`))
          );
          this.$.thumbUrl = `url(${thumbUrl})`;
        }
      });

      /** @type {File} */
      this.file = this.entry.getValue('file');
      /** @type {String} */
      this.externalUrl = this.entry.getValue('externalUrl');

      if (!this.getCssData('--cfg-confirm-upload')) {
        this.upload();
      }

      /** @private */
      this._observer = new window.IntersectionObserver(this._observerCallback.bind(this), {
        root: this.parentElement,
        rootMargin: '50% 0px 50% 0px',
        threshold: [0, 1],
      });
      this._observer.observe(this);
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
    FileItem.activeInstances.delete(this);
    // this._observer.unobserve(this);
    clearTimeout(this._thumbTimeoutId);
  }

  async upload() {
    if (this.hasAttribute('loaded') || this.entry.getValue('uuid')) {
      return;
    }
    this.entry.setValue('isUploading', true);
    this.entry.setValue('uploadError', null);

    this.removeAttribute('focused');
    this.removeAttribute('error');
    this.setAttribute('uploading', '');
    if (!this.file && this.externalUrl) {
      this.$.progressUnknown = true;
    }
    try {
      let fileInfo = await uploadFile(this.file || this.externalUrl, {
        ...this.getUploadClientOptions(),
        fileName: this.entry.getValue('fileName'),
        onProgress: (progress) => {
          if (progress.isComputable) {
            let percentage = progress.value * 100;
            this.entry.setValue('uploadProgress', percentage);
          }
          this.$.progressUnknown = !progress.isComputable;
        },
      });
      this.entry.setValue('isUploading', false);
      this.setAttribute('loaded', '');
      this.removeAttribute('uploading');
      this.$.badgeIcon = 'badge-success';
      this.entry.setMultipleValues({
        fileInfo,
        uploadProgress: 100,
        fileName: fileInfo.name,
        fileSize: fileInfo.size,
        isImage: fileInfo.isImage,
        mimeType: fileInfo.mimeType,
        uuid: fileInfo.uuid,
        cdnUrl: fileInfo.cdnUrl,
      });
    } catch (error) {
      this.$.badgeIcon = 'badge-error';
      this.entry.setValue('isUploading', false);
      this.$.progressValue = 0;
      this.setAttribute('error', '');
      this.removeAttribute('uploading');
      this.entry.setValue('uploadProgress', 0);
      // this.entry.setValue('uploadError', error);
      this.entry.setValue('uploadErrorMsg', error?.toString() || 'Upload error');
    }
  }
}

FileItem.template = /*html*/ `
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
`;
FileItem.activeInstances = new Set();
