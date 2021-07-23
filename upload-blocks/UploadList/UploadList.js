import { AppComponent } from '../AppComponent/AppComponent.js';
import { FileItem } from '../FileItem/FileItem.js';

window.customElements.define('file-item', FileItem);

export class UploadList extends AppComponent {

  constructor() {
    super();
    this.initLocalState({
      uploadBtnDisabled: false,
      'on.add': () => {
        this.appState.pub('currentActivity', 'source-select');
      },
      'on.upload': () => {
        this.localState.pub('uploadBtnDisabled', true);
        this.appState.pub('uploadTrigger', {});
      },
      'on.cancel': () => {
        this.appState.pub('confirmationAction', () => {
          this.appState.pub('modalActive', false);
          this.collection.clearAll();
        });
        this.appState.pub('currentActivity', 'confirmation');
      },
    });

    this._renderMap = Object.create(null);
  }

  connectedCallback() {
    super.connectedCallback();

    this.appState.sub('uploadCollection', (collection) => {
      /** @type {import('../AppComponent/TypedCollection.js').TypedCollection} */
      this.collection = collection;
      this.collection.observe(() => {
        let notUploaded = this.collection.findItems((item) => {
          return !item.getValue('uuid');
        });
        this.localState.pub('uploadBtnDisabled', !notUploaded.length);
      });
    });
    this.appState.sub('uploadList', (/** @type {String[]} */ list) => {
      if (!list.length) {
        this.appState.pub('currentActivity', '');
        return;
      }
      list.forEach((id) => {
        if (!this._renderMap[id]) {
          let item = new FileItem();
          item.setAttribute('ctx-name', this.ctxName);
          this.ref.files.prepend(item);
          item.setAttribute('entry-id', id);
          this._renderMap[id] = item;
        }
        for (let id in this._renderMap) {
          if (!list.includes(id)) {
            this._renderMap[id].remove();
            delete this._renderMap[id];
          }
        }
      });
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
  <button -cancel-btn- sub="onclick: on.cancel;"></button>
  <div></div>
  <button -add-more-btn- sub="onclick: on.add"></button>
  <button -upload-btn- sub="onclick: on.upload; @disabled: uploadBtnDisabled"></button>
</div>
`;
