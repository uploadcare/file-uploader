import { BlockComponent } from '../BlockComponent/BlockComponent.js';
import { resizeImage } from '../utils/resizeImage.js';
import { uploadFile } from '@uploadcare/upload-client';
import { UiMessage } from '../MessageBox/MessageBox.js';
import { fileCssBg } from '../svg-backgrounds/svg-backgrounds.js';

export class FileItem extends BlockComponent {
  pauseRender = true;

  init$ = {
    itemName: '',
    thumb: '',
    thumbUrl: '',
    progressWidth: 0,
    progressOpacity: 1,
    notImage: true,
    badgeIcon: 'check',
    '*focusedEntry': null,
    '*uploadTrigger': null,

    onEdit: () => {
      this.set$({
        '*focusedEntry': this.entry,
        '*currentActivity': BlockComponent.activities.DETAILS,
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
      resizeImage(this.file, this.$['*--cfg-thumb-size'] || 76).then((url) => {
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

  initCallback() {
    this.bindCssData('--cfg-thumb-size');
    this.defineAccessor('entry-id', (id) => {
      if (!id) {
        return;
      }
      /** @type {String} */
      this.uid = id;

      /** @type {import('@symbiotejs/symbiote').TypedData} */
      this.entry = this.uploadCollection?.read(id);

      this.entry.subscribe('fileName', (name) => {
        this.$.itemName = name || this.externalUrl || this.l10n('file-no-name');
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
          let url = `https://ucarecdn.com/${uuid}/`;
          this._revokeThumbUrl();
          let size = this.$['*--cfg-thumb-size'] || 76;
          this.$.thumbUrl = `url(${url}-/scale_crop/${size}x${size}/center/)`;
        }
      });

      this.entry.subscribe('transformationsUrl', (transformationsUrl) => {
        if (!transformationsUrl) {
          return;
        }
        if (this.entry.getValue('isImage')) {
          this._revokeThumbUrl();
          let size = this.$['*--cfg-thumb-size'] || 76;
          this.$.thumbUrl = `url(${transformationsUrl}-/scale_crop/${size}x${size}/center/)`;
        }
      });

      /** @type {File} */
      this.file = this.entry.getValue('file');
      /** @type {String} */
      this.externalUrl = this.entry.getValue('externalUrl');

      if (!this.$['*--cfg-confirm-upload']) {
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

    this.$['*uploadTrigger'] = null;
    FileItem.activeInstances.add(this);

    this.sub('*uploadTrigger', (val) => {
      if (!val || !this.isConnected) {
        return;
      }
      this.upload();
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
  }

  destroyCallback() {
    FileItem.activeInstances.delete(this);
    this._observer.unobserve(this);
    clearTimeout(this._thumbTimeoutId);
  }

  async upload() {
    if (this.hasAttribute('loaded') || this.entry.getValue('uuid')) {
      return;
    }
    this.$.progressWidth = 0;
    this.$.progressOpacity = 1;
    this.removeAttribute('focused');
    this.removeAttribute('error');
    this.setAttribute('uploading', '');
    let storeSetting = {};
    let store = this.$['*--cfg-store'];
    if (store !== null) {
      storeSetting.store = !!store;
    }
    try {
      // @ts-ignore
      let fileInfo = await uploadFile(this.file || this.externalUrl, {
        ...storeSetting,
        publicKey: this.$['*--cfg-pubkey'],
        onProgress: (progress) => {
          let percentage = progress.value * 100;
          this.$.progressWidth = percentage + '%';
          this.entry.setValue('uploadProgress', percentage);
        },
      });
      this.$.progressOpacity = 0;
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
      });
    } catch (error) {
      this.$.progressOpacity = 0;
      this.$.progressWidth = 0;
      this.setAttribute('error', '');
      this.removeAttribute('uploading');
      let msg = new UiMessage();
      msg.caption = this.l10n('upload-error') + ': ' + (this.file?.name || this.externalUrl);
      msg.text = error;
      msg.isError = true;
      this.set$({
        badgeIcon: 'badge-error',
        '*message': msg,
      });
      this.entry.setValue('uploadError', error);
    }
  }
}

FileItem.template = /*html*/ `
<div
  class="thumb"
  set="style.backgroundImage: thumbUrl">
  <div class="badge">
    <uc-icon set="@name: badgeIcon"></uc-icon>
  </div>
</div>
<div class="file-name-wrapper">
  <span class="file-name" set="@title: itemName">{{itemName}}</span>
</div>
<button class="edit-btn" set="onclick: onEdit;">
  <uc-icon name="edit-file"></uc-icon>
</button>
<button class="remove-btn" set="onclick: onRemove;">
  <uc-icon name="remove-file"></uc-icon>
</button>
<button class="upload-btn" set="onclick: onUpload;">
  <uc-icon name="upload"></uc-icon>
</button>
<div
  class="progress"
  set="style.width: progressWidth; style.opacity: progressOpacity">
</div>
`;
FileItem.activeInstances = new Set();

FileItem.bindAttributes({
  'entry-id': null,
});
