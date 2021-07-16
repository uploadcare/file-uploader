import { AppComponent } from '../AppComponent/AppComponent.js';
import { FileItem } from '../FileItem/FileItem.js';

window.customElements.define('file-item', FileItem);

export class UploadList extends AppComponent {

  constructor() {
    super();
    this._uploads = [];
    this._ufailed = [];

    this._uploadHandler = (e) => {
      if (e.detail.type === 'success') {
        this._uploads.push(e.detail);
      }
      if (e.detail.type === 'error') {
        this._uploads.push(e.detail.fileName);
      }
    };

    this.initLocalState({
      uploadBtnDisabled: false,
      'on.upload': () => {
        this.localState.pub('uploadBtnDisabled', true);
        this.appState.pub('uploadTrigger', {});
        this.appState.sub('uploads', (val) => {
          let errors = this.appState.read('errors');
          if ((val?.length + errors.length) === this._files.length) {
            this.appState.pub('files', []);
            this.appState.pub('currentActivity', 'uploads-list');
          }
        });
      },
      'on.cancel': () => {
        this.appState.pub('modalActive', false);
        this.appState.pub('files', []);
      },
    });
  }

  connectedCallback() {
    this.addToAppState({
      listActive: false,
      pubkey: 'demopublickey',
    });
    super.connectedCallback();
    this.appState.sub('files', (/** @type {File[]} */ files) => {
      this.ref.files.innerHTML = '';
      if (!files?.length) {
        this.appState.pub('modalActive', false);
        return;
      }
      if (files.length) {
        this._files = files;
        this.localState.pub('uploadBtnDisabled', false);
        // console.log(files);
        files.forEach((file) => {
          let item = new FileItem();
          item.file = file;
          item.setAttribute('ctx-name', this.getAttribute('ctx-name'));
          this.ref.files.appendChild(item);
        });
      }
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.filesObserver) {
      this.filesObserver.disconnect();
      this.filesObserver = null;
    }
  }
}

UploadList.template = /*html*/ `
<div -files-el- ref="files"></div>
<div -toolbar-el->
  <button -cancel-btn- sub="onclick: on.cancel"></button>
  <button -upload-btn- sub="onclick: on.upload; @disabled: uploadBtnDisabled"></button>
</div>
`;
