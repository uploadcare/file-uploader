import { AppComponent } from '../AppComponent/AppComponent.js';
import { UploadClientLight } from '../../common-utils/UploadClientLight.js';

const ICONS = {
  remove: 'M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,2C6.47,2 2,6.47 2,12C2,17.53 6.47,22 12,22C17.53,22 22,17.53 22,12C22,6.47 17.53,2 12,2M14.59,8L12,10.59L9.41,8L8,9.41L10.59,12L8,14.59L9.41,16L12,13.41L14.59,16L16,14.59L13.41,12L16,9.41L14.59,8Z',
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
      uploadOutput: [],
    });
    FileItem.activeInstances.add(this);
    this.localState.pub('fileName', this._file?.name || 'Empty');
    
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
    this._uploadHandler = (e) => {
      if (e.detail.uploadId !== fileName) {
        return;
      }
      // console.log(e.detail);
      if (e.detail.type === 'progress') {
        this.ref.progress.style.width = e.detail.progress + '%';
      }
      if (e.detail.type === 'success') {
        this.ref.progress.style.opacity = '0';
      }
      if (e.detail.type === 'error') {
        this.ref.progress.style.setProperty('--clr-shade-1', 'rgba(255, 20, 20, .06)');
        this.appState.pub('message', {
          text: 'Eorror',
          type: 'error',
        });
      }
    };
    window.addEventListener('uc-client-event', this._uploadHandler);
    let fileInfo = await UploadClientLight.uploadFileDirect(this._file, this.appState.read('pubkey'), fileName);
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
