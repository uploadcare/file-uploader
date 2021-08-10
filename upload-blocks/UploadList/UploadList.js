import { BlockComponent } from '../BlockComponent/BlockComponent.js';
import { FileItem } from '../FileItem/FileItem.js';

export class UploadList extends BlockComponent {

  constructor() {
    super();
    this.initLocalState({
      uploadBtnDisabled: false,
      'on.add': () => {
        this.pub('external', 'currentActivity', 'source-select');
      },
      'on.upload': () => {
        this.pub('local', 'uploadBtnDisabled', true);
        this.pub('external', 'uploadTrigger', {});
      },
      'on.cancel': () => {
        this.pub('external', 'confirmationAction', () => {
          this.pub('external', 'modalActive', false);
          this.uploadCollection.clearAll();
        });
        this.pub('external', 'currentActivity', 'confirmation');
      },
    });

    this._renderMap = Object.create(null);
  }

  initCallback() {
    this.uploadCollection.observe(() => {
      let notUploaded = this.uploadCollection.findItems((item) => {
        return !item.getValue('uuid');
      });
      this.pub('local', 'uploadBtnDisabled', !notUploaded.length);
    });
    this.sub('external', 'uploadList', (/** @type {String[]} */ list) => {
      if (!list.length) {
        this.pub('external', 'currentActivity', '');
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
<div .files-el ref="files"></div>
<div .toolbar-el>
  <button .cancel-btn loc="onclick: on.cancel;"></button>
  <div></div>
  <button .add-more-btn loc="onclick: on.add"></button>
  <button .upload-btn loc="onclick: on.upload; @disabled: uploadBtnDisabled"></button>
</div>
`;
