import { AppComponent } from '../AppComponent/AppComponent.js';
import { UploadClientLight } from '../../common-utils/UploadClientLight.js';
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
    this.render();
    this.addToAppState({
      focusedItem: null,
      uploadOutput: [],
    });
    FileItem.activeInstances.add(this);
    this.localState.pub('fileName', this._file?.name || 'Empty');
    if (this._file.type.includes('image')) {
      resizeImage(this._file, 76).then((img) => {
        this.ref.thumb.style.backgroundImage = `url(${img})`;
      });
    }
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
    let fileName = this.localState.read('fileName');
    this.removeAttribute('focused');
    this.setAttribute('uploading', '');
    let uploadId = this.ctxName + ':' + fileName;
    this._uploadHandler = (e) => {
      if (e.detail.uploadId !== uploadId) {
        return;
      }
      // console.log(e.detail);
      if (e.detail.type === 'progress') {
        this.ref.progress.style.width = e.detail.progress + '%';
      }
      if (e.detail.type === 'success') {
        this.ref.progress.style.opacity = '0';
        this.setAttribute('loaded', '');
        this.removeAttribute('uploading');
      }
      if (e.detail.type === 'error') {
        this.setAttribute('error', '');
        this.appState.pub('message', {
          text: 'Eorror',
          type: 'error',
        });
      }
    };
    window.addEventListener('uc-client-event', this._uploadHandler);
    let fileInfo = await UploadClientLight.uploadFileDirect(this._file, this.appState.read('pubkey'), uploadId);
    window.removeEventListener('uc-client-event', this._uploadHandler);
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
<button sub="onclick: on.remove;">
  <icon-ui path="${ICONS.remove}"></icon-ui>
</button>
<div ref="progress" -progress-></div>
`;
FileItem.activeInstances = new Set();
