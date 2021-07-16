import { AppComponent } from '../AppComponent/AppComponent.js';
import { uploadFileDirect } from '../../common-utils/UploadClientLight.js';
import { resizeImage } from '../../common-utils/resizeImage.js'

const ICONS = {
  remove: 'M19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5A2,2 0 0,0 19,3M19,19H5V5H19V19M17,8.4L13.4,12L17,15.6L15.6,17L12,13.4L8.4,17L7,15.6L10.6,12L7,8.4L8.4,7L12,10.6L15.6,7L17,8.4Z',
  edit: 'M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z',
};

export class FileItem extends AppComponent {
  constructor() {
    super();
    this.initLocalState({
      fileName: '',
      thumb: '',
      notImage: true,
      'on.edit': () => {
        this.appState.pub('modalCaption', 'Edit file');
        this.appState.pub('focusedFile', this._file);
        this.appState.pub('prevActivity', 'upload-list');
        this.appState.pub('currentActivity', 'pre-edit');
      },
      'on.remove': () => {
        this.remove();
      },
    });
  }

  /** @param {File} file */
  set file(file) {
    this._file = file;
  }

  connectedCallback() {
    super.connectedCallback();
    this.addToAppState({
      focusedItem: null,
      uploadOutput: [],
      uploadTrigger: null,
      uploads: [],
      errors: [],
    });
    this.appState.pub('uploadTrigger', null);
    FileItem.activeInstances.add(this);
    this.localState.pub('fileName', this._file?.name || 'Empty');
    if (this._file.type.includes('image')) {
      resizeImage(this._file, 76).then((img) => {
        this.ref.thumb.style.backgroundImage = `url(${img})`;
      });
    }
    this.appState.sub('uploadTrigger', (val) => {
      if (!val) {
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
    this.removeAttribute('focused');
    this.setAttribute('uploading', '');
    let fileInfo = await uploadFileDirect(this._file, this.appState.read('pubkey'), (info) => {
      if (info.type === 'progress') {
        this.ref.progress.style.width = info.progress + '%';
      }
      if (info.type === 'success') {
        this.ref.progress.style.opacity = '0';
        this.setAttribute('loaded', '');
        this.removeAttribute('uploading');
        let uploads = this.appState.read('uploads');
        uploads.push(info);
        this.appState.pub('uploads', [...uploads]);
      }
      if (info.type === 'error') {
        this.setAttribute('error', '');
        let errors = this.appState.read('errors');
        errors.push(this._file);
        this.appState.pub('errors', [...errors]);
        this.appState.pub('message', {
          caption: 'Upload error: ' + this._file.name,
          text: info.error,
          isError: true,
        });
      }
    });
    let outArr = this.appState.read('uploadOutput');
    outArr.push(fileInfo.cdnUrl);
    this.appState.pub('uploadOutput', [...outArr]);
    // this.remove();
  }
}

FileItem.template = /*html*/ `
<div -thumb- ref="thumb"></div>
<div file-name sub="textContent: fileName"></div>
<button -edit-btn- sub="onclick: on.edit;">
  <icon-ui path="${ICONS.edit}"></icon-ui>
</button>
<div ref="progress" -progress-></div>
`;
FileItem.activeInstances = new Set();
