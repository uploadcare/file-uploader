import { BlockComponent } from '../BlockComponent/BlockComponent.js';
import { resizeImage } from '../../common-utils/resizeImage.js';
import { ACT } from '../dictionary.js';
import { uploadFile } from '../../web_modules/upload-client.js';

export class FileItem extends BlockComponent {
  init$ = {
    fileName: '',
    thumb: '',
    notImage: true,
    badgeIcon: 'check',
    onEdit: () => {
      this.set$({
        '*modalCaption': 'Edit file',
        '*focusedEntry': this.entry,
        '*currentActivity': ACT.UPLOAD_DETAILS,
      });
    },
    '*focusedEntry': null,
    '*uploadTrigger': null,
  };

  set 'entry-id'(id) {
    /** @type {import('../../symbiote/core/TypedData.js').TypedData} */
    this.entry = this.uploadCollection?.read(id);

    this.entry.subscribe('uuid', (uuid) => {
      if (uuid) {
        this.setAttribute('loaded', '');
      }
    });

    this.entry.subscribe('fileName', (name) => {
      this.$.fileName = name || 'No name...';
    });

    this.entry.subscribe('uuid', (uuid) => {
      if (!uuid) {
        return;
      }
      let url = `https://ucarecdn.com/${uuid}/`;
      this.ref.thumb.style.backgroundImage = `url(${url}-/scale_crop/76x76/)`;
    });

    this.entry.subscribe('transformationsUrl', (transformationsUrl) => {
      if (!transformationsUrl) {
        return;
      }
      this.ref.thumb.style.backgroundImage = `url(${transformationsUrl}-/scale_crop/76x76/)`;
    });

    this.file = this.entry.getValue('file');

    if (this.file?.type.includes('image')) {
      resizeImage(this.file, 76).then((img) => {
        this.ref.thumb.style.backgroundImage = `url(${img})`;
      });
    }
  }

  get 'entry-id'() {
    return this.entry.__ctxId;
  }

  initCallback() {
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
    super.disconnectedCallback();
    FileItem.activeInstances.delete(this);
  }

  async upload() {
    if (this.hasAttribute('loaded') || this.entry.getValue('uuid')) {
      return;
    }
    this.ref.progress.style.width = '0';
    this.removeAttribute('focused');
    this.removeAttribute('error');
    this.setAttribute('uploading', '');
    try {
      // @ts-ignore
      let fileInfo = await uploadFile(this.file, {
        publicKey: this.config.PUBKEY,
        onProgress: (progress) => {
          let percentage = progress.value * 100;
          this.ref.progress.style.width = percentage + '%';
          this.entry.setValue('uploadProgress', percentage);
        },
      });
      this.ref.progress.style.opacity = '0';
      this.setAttribute('loaded', '');
      this.removeAttribute('uploading');
      this.$.badgeIcon = 'check';
      this.entry.setValue('uuid', fileInfo.uuid);
      this.entry.setValue('uploadProgress', 100);
    } catch (error) {
      this.setAttribute('error', '');
      this.removeAttribute('uploading');
      this.set$({
        badgeIcon: 'upload-error',
        '*message': {
          caption: 'Upload error: ' + this.file.name,
          text: error,
          isError: true,
        },
      });
      this.entry.setValue('uploadErrorMsg', error);
    }
  }
}

FileItem.template = /*html*/ `
<div .thumb ref="thumb"></div>
<div file-name set="textContent: fileName"></div>
<div .badge>
  <uc-icon set="@name: badgeIcon"></uc-icon>
</div>
<button .edit-btn set="onclick: onEdit;">
  <uc-icon name="edit-file"></uc-icon>
</button>
<div ref="progress" .progress></div>
`;
FileItem.activeInstances = new Set();

FileItem.bindAttributes({
  'entry-id': null,
});
