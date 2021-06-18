import { AppComponent } from '../AppComponent/AppComponent.js';
import { FileItem } from '../FileItem/FileItem.js';

window.customElements.define('file-item', FileItem);

export class UploadList extends AppComponent {
  constructor() {
    super();
    this.initLocalState({
      uploadBtnTxt: 'Upload',
      uploadClicked: () => {
        [...this.refs.files.querySelectorAll('file-item')].forEach((/** @type {FileItem} */ item) => {
          item.upload();
        });
      },
    });
    this.addToAppState({
      listActive: false,
      pubkey: 'demopublickey',
    });
  }

  connectedCallback() {
    super.connectedCallback();
    this.render();
    this.appState.sub('files', (/** @type {File[]} */ files) => {
      this.refs.files.innerHTML = '';
      if (!files) {
        return;
      }
      if (files.length) {
        this.appState.pub('modalActive', true);
        this.appState.pub('modalCaption', 'Selected files');
        this.appState.pub('listActive', true);
        console.log(files);
        files.forEach((file) => {
          let item = new FileItem();
          item.file = file;
          item.setAttribute('ctx-name', this.getAttribute('ctx-name'));
          this.refs.files.appendChild(item);
        });
        this.filesObserver = new MutationObserver(() => {
          if (!this.refs.files.childNodes.length) {
            this.appState.pub('listActive', false);
            this.appState.pub('modalActive', false);
          }
        });
        this.filesObserver.observe(this.refs.files, {
          childList: true,
        });
      }
    });
    this.appState.sub('listActive', (val) => {
      val ? this.setAttribute('active', '') : this.removeAttribute('active');
      if (val) {
        this.appState.pub('urlActive', false);
      }
    });
  }

  attributeChangedCallback(name, oldVal, newVal) {
    console.log(name, newVal);
    let attrHandlers = {
      pubkey: () => {
        this.appState.pub('pubkey', newVal);
      },
      'btn-txt': () => {
        window.setTimeout(() => {
          this.localState?.pub('uploadBtnTxt', newVal);
        });
      },
    };
    attrHandlers[name]();
  }

  static get observedAttributes() {
    return ['pubkey', 'btn-txt'];
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.filesObserver.disconnect();
    this.filesObserver = null;
  }
}

UploadList.template = /*html*/ `
<div files-el ref="files"></div>
<div toolbar-el>
  <button upload-btn sub="textContent: uploadBtnTxt; onclick: uploadClicked"></button>
</div>
`;
