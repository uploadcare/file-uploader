import { AppComponent } from '../AppComponent/AppComponent.js';
import { UploadClientLight } from '../../common-utils/UploadClientLight.js';

export class FileItem extends AppComponent {
  constructor() {
    super();
    this.initLocalState({
      fileName: '',
      thumb: '📄',
      notImage: true,
      onRemove: () => {
        this.remove();
      },
      removeTxt: '✖️',
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
    this.localState.pub('fileName', this._file.name);
    this.localState.pub('thumb', this._file.type.includes('image') ? '🏙' : '📄');
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
    let fileInfo = await UploadClientLight.uploadFileDirect(this._file, this.appState.read('pubkey'), this.localState.read('fileName'));
    let outArr = this.appState.read('uploadOutput');
    outArr.push(fileInfo.cdnUrl);
    this.appState.pub('uploadOutput', [...outArr]);
    this.remove();
  }
}

FileItem.template = /*html*/ `
<div img-mark-el sub="textContent: thumb"></div>
<div file-name sub="textContent: fileName"></div>
<button sub="onclick: onRemove; textContent: removeTxt"></button>
`;
FileItem.activeInstances = new Set();
