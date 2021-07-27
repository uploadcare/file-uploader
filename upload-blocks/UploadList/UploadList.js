import { BaseComponent } from '../../symbiote/core/BaseComponent.js';
import { FileItem } from '../FileItem/FileItem.js';

export class UploadList extends BaseComponent {

  constructor() {
    super();
    this.initLocalState({
      uploadBtnDisabled: false,
      'on.add': () => {
        this.externalState.pub('currentActivity', 'source-select');
      },
      'on.upload': () => {
        this.localState.pub('uploadBtnDisabled', true);
        this.externalState.pub('uploadTrigger', {});
      },
      'on.cancel': () => {
        this.externalState.pub('confirmationAction', () => {
          this.externalState.pub('modalActive', false);
          this.collection.clearAll();
        });
        this.externalState.pub('currentActivity', 'confirmation');
      },
    });

    this._renderMap = Object.create(null);
  }

  initCallback() {
    this.externalState.sub('uploadCollection', (collection) => {
      /** @type {import('../../symbiote/core/TypedCollection.js').TypedCollection} */
      this.collection = collection;
      this.collection.observe(() => {
        let notUploaded = this.collection.findItems((item) => {
          return !item.getValue('uuid');
        });
        this.localState.pub('uploadBtnDisabled', !notUploaded.length);
      });
    });
    this.externalState.sub('uploadList', (/** @type {String[]} */ list) => {
      if (!list.length) {
        this.externalState.pub('currentActivity', '');
        return;
      }
      list.forEach((id) => {
        if (!this._renderMap[id]) {
          let item = new FileItem();
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
  
}

UploadList.template = /*html*/ `
<div -files-el- ref="files"></div>
<div -toolbar-el->
  <button -cancel-btn- loc="onclick: on.cancel;"></button>
  <div></div>
  <button -add-more-btn- loc="onclick: on.add"></button>
  <button -upload-btn- loc="onclick: on.upload; @disabled: uploadBtnDisabled"></button>
</div>
`;
