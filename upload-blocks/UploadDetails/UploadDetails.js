import { BlockComponent } from '../BlockComponent/BlockComponent.js';

export class UploadDetails extends BlockComponent {
  constructor() {
    super();
    this.initLocalState({
      fileSize: 0,
      cdnUrl: '',
      errorTxt: '',
      editBtnHidden: true,
      'on.back': () => {
        this.historyBack();
      },
      'on.remove': () => {
        /** @type {File[]} */
        this.uploadCollection.remove(this.entry.__ctxId);
        this.historyBack();
      },
      'on.tabSelected': (e) => {
        console.log(e.detail);
      },
      'on.edit': () => {
        if (this.entry.getValue('uuid')) {
          this.externalState.pub('currentActivity', 'cloud-image-edit');
        }
      },
    });
  }

  initCallback() {
    this.addToExternalState({
      focusedEntry: null,
    });
    /** @type {import('../EditableCanvas/EditableCanvas.js').EditableCanvas} */
    // @ts-ignore
    this.eCanvas = this.ref.canvas;
    this.sub(
      'external',
      'focusedEntry',
      (/** @type {import('../../symbiote/core/TypedState.js').TypedState} */ entry) => {
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
            this.multiPub('local', {
              editBtnHidden: false,
            });
          }
        }
        this.entry.subscribe('fileName', (name) => {
          this.ref['file-name-input']['value'] = name;
          this.ref['file-name-input'].oninput = () => {
            Object.defineProperty(this._file, 'name', {
              writable: true,
              value: this.ref['file-name-input']['value'],
            });
          };
        });
        this.entry.subscribe('fileSize', (size) => {
          this.pub('local', 'fileSize', size);
        });
        this.entry.subscribe('uuid', (uuid) => {
          if (uuid) {
            this.pub('local', 'cdnUrl', `https://ucarecdn.com/${uuid}/`);
          } else {
            this.pub('local', 'cdnUrl', 'Not uploaded yet...');
          }
        });
        this.entry.subscribe('uploadErrorMsg', (msg) => {
          this.pub('local', 'errorTxt', msg);
        });

        this.entry.subscribe('externalUrl', (url) => {
          if (!url) {
            return;
          }
          if (this.entry.getValue('isImage') && !this.entry.getValue('transformationsUrl')) {
            this.eCanvas.setImageUrl(this.localState.read('cdnUrl'));
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
      }
    );
  }
}

UploadDetails.template = /*html*/ `
<uc-tabs 
  tab-list="tab-view, tab-details"
  loc="onchange: on.tabSelected">
  <div tab-ctx="tab-details" ref="details" .details>

    <div .info-block>
      <div .info-block_name l10n="file-name"></div>
      <input name="name-input" ref="file-name-input" type="text" />
    </div>

    <div .info-block>
      <div .info-block_name l10n="file-size"></div>
      <div loc="textContent: fileSize"></div>
    </div>

    <div .info-block>
      <div .info-block_name l10n="cdn-url"></div>
      <a target="_blank" loc="textContent: cdnUrl; @href: cdnUrl;"></a>
    </div>

    <div loc="textContent: errorTxt;"></div>

  </div>

  <div tab-ctx="tab-view" ref="viewport" .viewport>
    <uc-editable-canvas 
      tab-ctx="tab-view"
      ref="canvas">
    </uc-editable-canvas>
  </div>
</uc-tabs>

<div .toolbar>
  <button .back-btn loc="onclick: on.back">
    <uc-icon-ui name="back"></uc-icon-ui>
    <span l10n="back"></span>
  </button>
  <button .edit-btn loc="onclick: on.edit; @hidden: editBtnHidden;">
    <uc-icon-ui name="edit"></uc-icon-ui>
    <span l10n="edit-image"></span>
  </button>
  <button .remove-btn loc="onclick: on.remove">
    <uc-icon-ui name="remove"></uc-icon-ui>
    <span l10n="remove-from-list"></span>
  </button>
</div>
`;
