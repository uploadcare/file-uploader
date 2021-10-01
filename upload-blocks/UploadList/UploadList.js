import { BlockComponent } from '../BlockComponent/BlockComponent.js';
import { FileItem } from '../FileItem/FileItem.js';

export class UploadList extends BlockComponent {
  init$ = {
    uploadBtnDisabled: false,
    'on.add': () => {
      this.$['*currentActivity'] = 'source-select';
    },
    'on.upload': () => {
      this.set$({
        uploadBtnDisabled: true,
        '*uploadTrigger': {},
      });
    },
    'on.cancel': () => {
      this.set$({
        '*confirmationAction': () => {
          this.$['*modalActive'] = false;
          this.uploadCollection.clearAll();
        },
        '*currentActivity': 'confirmation',
      });
    },
  };

  _renderMap = Object.create(null);

  initCallback() {
    this.uploadCollection.observe(() => {
      let notUploaded = this.uploadCollection.findItems((item) => {
        return !item.getValue('uuid');
      });
      this.$.uploadBtnDisabled = !notUploaded.length;
    });
    this.sub('*uploadList', (/** @type {String[]} */ list) => {
      if (!list.length) {
        this.$['*currentActivity'] = '';
        return;
      }
      list.forEach((id) => {
        if (!this._renderMap[id]) {
          let item = new FileItem();
          this.ref.files.prepend(item);
          item['entry-id'] = id;
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
  <button 
    .cancel-btn 
    set="onclick: on.cancel;" 
    l10n="cancel"></button>
  <div></div>
  <button 
    .add-more-btn 
    set="onclick: on.add" 
    l10n="add-more"></button>
  <button 
    .upload-btn 
    set="onclick: on.upload; @disabled: uploadBtnDisabled" 
    l10n="upload"></button>
</div>
`;
