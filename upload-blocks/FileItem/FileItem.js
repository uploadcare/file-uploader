import { BlockComponent } from '../BlockComponent/BlockComponent.js';
import { uploadFileDirect } from '../../common-utils/UploadClientLight.js';
import { resizeImage } from '../../common-utils/resizeImage.js';
import { ACT } from '../dictionary.js';

export class FileItem extends BlockComponent {
  constructor() {
    super();

    this.initLocalState({
      fileName: '',
      thumb: '',
      notImage: true,
      badgeIcon: 'check',
      'on.edit': () => {
        this.multiPub('external', {
          modalCaption: 'Edit file',
          focusedEntry: this.entry,
          currentActivity: ACT.UPLOAD_DETAILS,
        });
      },
    });
  }

  set 'entry-id'(id) {
    /** @type {import('../../symbiote/core/TypedState.js').TypedState} */
    this.entry = this.uploadCollection?.read(id);

    this.entry.subscribe('uuid', (uuid) => {
      if (uuid) {
        this.setAttribute('loaded', '');
      }
    });

    this.entry.subscribe('fileName', (name) => {
      this.pub('local', 'fileName', name || 'No name...');
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
    this.addToExternalState({
      focusedEntry: null,
      uploadTrigger: null,
    });

    this.pub('external', 'uploadTrigger', null);
    FileItem.activeInstances.add(this);

    this.sub('external', 'uploadTrigger', (val) => {
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

  disconnectedCallback() {
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
    await uploadFileDirect(this.file, this.config.PUBKEY, async (info) => {
      if (info.type === 'progress') {
        this.ref.progress.style.width = info.progress + '%';
        this.entry.setValue('uploadProgress', info.progress);
      }
      if (info.type === 'success') {
        this.ref.progress.style.opacity = '0';
        this.setAttribute('loaded', '');
        this.removeAttribute('uploading');
        this.pub('local', 'badgeIcon', 'check');
        this.entry.setValue('uuid', info.uuid);
        this.entry.setValue('uploadProgress', 100);
      }
      if (info.type === 'error') {
        this.setAttribute('error', '');
        this.removeAttribute('uploading');
        this.multiPub('local', {
          badgeIcon: 'upload-error',
        });
        this.pub('external', 'message', {
          caption: 'Upload error: ' + this.file.name,
          text: info.error,
          isError: true,
        });
        this.entry.setValue('uploadErrorMsg', info.error);
      }
    });
  }
}

FileItem.template = /*html*/ `
<div .thumb ref="thumb"></div>
<div file-name loc="textContent: fileName"></div>
<div .badge>
  <uc-icon loc="@name: badgeIcon"></uc-icon>
</div>
<button .edit-btn loc="onclick: on.edit;">
  <uc-icon name="edit-file"></uc-icon>
</button>
<div ref="progress" .progress></div>
`;
FileItem.activeInstances = new Set();

FileItem.bindAttributes({
  'entry-id': ['property'],
});
