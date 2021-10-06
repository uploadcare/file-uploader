import { BlockComponent } from '../BlockComponent/BlockComponent.js';
import { FileItem } from '../FileItem/FileItem.js';

export class UploadList extends BlockComponent {
  init$ = {
    uploadBtnDisabled: false,
    onAdd: () => {
      this.$['*currentActivity'] = 'source-select';
    },
    onUpload: () => {
      this.set$({
        uploadBtnDisabled: true,
        '*uploadTrigger': {},
      });
    },
    onCancel: () => {
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
    set="onclick: onCancel;" 
    l10n="cancel"></button>
  <div></div>
  <button 
    .add-more-btn 
    set="onclick: onAdd" 
    l10n="add-more"></button>
  <button 
    .upload-btn 
    set="onclick: onUpload; @disabled: uploadBtnDisabled" 
    l10n="upload"></button>
</div>
`;
