import { BlockComponent } from '../BlockComponent/BlockComponent.js';

export class UploadDetails extends BlockComponent {
  init$ = {
    fileSize: 0,
    fileName: '',
    cdnUrl: '',
    errorTxt: '',
    editBtnHidden: true,
    onNameInput: null,
    '*focusedEntry': null,
    onBack: () => {
      this.historyBack();
    },
    onRemove: () => {
      /** @type {File[]} */
      this.uploadCollection.remove(this.entry.__ctxId);
      this.historyBack();
    },
    onEdit: () => {
      if (this.entry.getValue('uuid')) {
        this.$['*currentActivity'] = BlockComponent.activities.CLOUD_IMG_EDIT;
      }
    },
  };

  initCallback() {
    /** @type {import('../EditableCanvas/EditableCanvas.js').EditableCanvas} */
    // @ts-ignore
    this.eCanvas = this.ref.canvas;
    this.sub('*focusedEntry', (/** @type {import('../../symbiote/core/TypedData.js').TypedData} */ entry) => {
      if (!entry) {
        return;
      }
      this.entry = entry;
      /** @type {File} */
      let file = entry.getValue('file');
      if (file) {
        /** @type {File} */
        this._file = file;
        if (this._file.type.includes('image') && !entry.getValue('transformationsUrl')) {
          this.eCanvas.setImageFile(this._file);
          this.set$({
            editBtnHidden: false,
          });
        }
      }
      this.entry.subscribe('fileName', (name) => {
        this.$.fileName = name;
        this.$.onNameInput = () => {
          Object.defineProperty(this._file, 'name', {
            writable: true,
            value: this.ref.file_name_input['value'],
          });
        };
      });
      this.entry.subscribe('fileSize', (size) => {
        this.$.fileSize = size;
      });
      this.entry.subscribe('uuid', (uuid) => {
        if (uuid) {
          this.$.cdnUrl = `https://ucarecdn.com/${uuid}/`;
        } else {
          this.$.cdnUrl = 'Not uploaded yet...';
        }
      });
      this.entry.subscribe('uploadErrorMsg', (msg) => {
        this.$.errorTxt = msg;
      });

      this.entry.subscribe('externalUrl', (url) => {
        if (!url) {
          return;
        }
        if (this.entry.getValue('isImage') && !this.entry.getValue('transformationsUrl')) {
          this.eCanvas.setImageUrl(this.$.cdnUrl);
        }
      });
      this.entry.subscribe('transformationsUrl', (url) => {
        if (!url) {
          return;
        }
        if (this.entry.getValue('isImage')) {
          this.eCanvas.setImageUrl(url);
        }
      });
    });
  }
}

UploadDetails.template = /*html*/ `
<div .wrapper>
  <uc-tabs 
    tab-list="tab-view, tab-details">
    <div tab-ctx="tab-details" ref="details" .details>

      <div .info-block>
        <div .info-block_name l10n="file-name"></div>
        <input 
          name="name-input"
          ref="file_name_input"
          set="value: fileName; oninput: onNameInput"
          type="text" />
      </div>

      <div .info-block>
        <div .info-block_name l10n="file-size"></div>
        <div set="textContent: fileSize"></div>
      </div>

      <div .info-block>
        <div .info-block_name l10n="cdn-url"></div>
        <a 
          target="_blank" 
          set="textContent: cdnUrl; @href: cdnUrl;"></a>
      </div>

      <div set="textContent: errorTxt;"></div>

    </div>

    <div tab-ctx="tab-view" ref="viewport" .viewport>
      <uc-editable-canvas 
        tab-ctx="tab-view"
        ref="canvas">
      </uc-editable-canvas>
    </div>
  </uc-tabs>

  <div .toolbar>
    <button 
      .secondary-btn
      .edit-btn 
      set="onclick: onEdit; @hidden: editBtnHidden;">
      <uc-icon name="edit"></uc-icon>
      <span l10n="edit-image"></span>
    </button>
    <button 
      .secondary-btn
      .remove-btn 
      set="onclick: onRemove">
      <uc-icon name="remove"></uc-icon>
      <span l10n="remove-from-list"></span>
    </button>
    <div></div>
    <button 
      .primary-btn
      .back-btn 
      set="onclick: onBack">
      <span l10n="done"></span>
    </button>
  </div>
</div>
`;
