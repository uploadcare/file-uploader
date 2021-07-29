import { BaseComponent } from '../../symbiote/core/BaseComponent.js';
import { uploadFileDirect } from '../../common-utils/UploadClientLight.js';
import { resizeImage } from '../../common-utils/resizeImage.js';
import { ACT } from '../dictionary.js';

const ICONS = {
  remove: 'M19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5A2,2 0 0,0 19,3M19,19H5V5H19V19M17,8.4L13.4,12L17,15.6L15.6,17L12,13.4L8.4,17L7,15.6L10.6,12L7,8.4L8.4,7L12,10.6L15.6,7L17,8.4Z',
  edit: 'M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z',
  ok: 'M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z',
  error: 'M11,15H13V17H11V15M11,7H13V13H11V7M12,2C6.47,2 2,6.5 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20Z',
};

export class FileItem extends BaseComponent {
  constructor() {
    super();

    this.initLocalState({
      fileName: '',
      thumb: '',
      notImage: true,
      badgeIcon: ICONS.ok,
      'on.edit': () => {
        this.externalState.multiPub({
          modalCaption: 'Edit file',
          focusedEntry: this.entry,
          currentActivity: ACT.UPLOAD_DETAILS,
        });
      },
    });
  }

  set 'entry-id'(id) {
    /** @type {import('../../symbiote/core/TypedState.js').TypedState} */
    this.entry = this.collection?.read(id);

    this.entry.subscribe('uuid', (uuid) => {
      if (uuid) {
        this.setAttribute('loaded', '');
      }
    });

    this.entry.subscribe('fileName', (name) => {
      this.localState.pub('fileName', name || 'No name...');
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
    this.externalState.sub('uploadCollection', (collection) => {
      /** @type {import('../../symbiote/core/TypedCollection.js').TypedCollection} */
      this.collection = collection;
    });
    this.externalState.pub('uploadTrigger', null);
    FileItem.activeInstances.add(this);

    this.externalState.sub('uploadTrigger', (val) => {
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
    await uploadFileDirect(this.file, this.externalState.read('pubkey'), async (info) => {
      if (info.type === 'progress') {
        this.ref.progress.style.width = info.progress + '%';
        this.entry.setValue('uploadProgress', info.progress);
      }
      if (info.type === 'success') {
        this.ref.progress.style.opacity = '0';
        this.setAttribute('loaded', '');
        this.removeAttribute('uploading');
        this.localState.pub('badgeIcon', ICONS.ok);
        this.entry.setValue('uuid', info.uuid);
        this.entry.setValue('uploadProgress', 100);
      }
      if (info.type === 'error') {
        this.setAttribute('error', '');
        this.removeAttribute('uploading');
        this.localState.multiPub({
          badgeIcon: ICONS.error,
        });
        this.externalState.pub('message', {
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
<div -thumb- ref="thumb"></div>
<div file-name loc="textContent: fileName"></div>
<div -badge->
  <icon-ui loc="@path: badgeIcon"></icon-ui>
</div>
<button -edit-btn- loc="onclick: on.edit;">
  <icon-ui path="${ICONS.edit}"></icon-ui>
</button>
<div ref="progress" -progress-></div>
`;
FileItem.activeInstances = new Set();

FileItem.bindAttributes({
  'entry-id': ['property'],
});
