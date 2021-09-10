import { BlockComponent } from '../BlockComponent/BlockComponent.js';

export class UploadDetails extends BlockComponent {
  constructor() {
    super();
    this.initLocalState({
      fileSize: 0,
      cdnUrl: '',
      errorTxt: '',
      'on.back': () => {
        this.historyBack();
      },
      'on.remove': () => {
        /** @type {File[]} */
        this.uploadCollection.remove(this.entry.__ctxId);
        this.historyBack();
      },
      'on.preview': () => {
        this.ref['preview-tab'].setAttribute('current', '');
        this.ref['details-tab'].removeAttribute('current');

        this.ref['viewport'].removeAttribute('hidden');
        this.ref['details'].setAttribute('hidden', '');
      },
      'on.details': () => {
        this.ref['details-tab'].setAttribute('current', '');
        this.ref['preview-tab'].removeAttribute('current');

        this.ref['details'].removeAttribute('hidden');
        this.ref['viewport'].setAttribute('hidden', '');
      },
      'on.edit': () => {
        if (this.entry.getValue('uuid')) {
          this.externalState.pub('currentActivity', 'cloud-image-edit');
        }
      },
    });
  }

  /** @param {File} imgFile */
  _renderFilePreview(imgFile) {
    let url = URL.createObjectURL(imgFile);
    this._renderPreview(url);
  }

  /** @param {String} url */
  _renderPreview(url) {
    /** @type {HTMLCanvasElement} */
    // @ts-ignore
    this._canv = this.ref.canvas;
    this._ctx = this._canv.getContext('2d');
    let img = new Image();
    img.onload = () => {
      this._canv.height = img.height;
      this._canv.width = img.width;
      this._ctx.drawImage(img, 0, 0);
    };
    img.src = url;
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
        if (this._ctx) {
          this._ctx.clearRect(0, 0, this._canv.width, this._canv.height);
        }
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
            this._renderPreview(this.localState.read('cdnUrl'));
          }
        });
        this.entry.subscribe('transformationsUrl', (url) => {
          if (!url) {
            return;
          }
          if (this.entry.getValue('isImage')) {
            this._renderPreview(url);
          }
        });
      }
    );
  }
}

UploadDetails.template = /*html*/ `
<div .tabs>
  <button current ref="preview-tab" loc="onclick: on.preview">Preview</button>
  <button ref="details-tab" loc="onclick: on.details">File Details</button>
</div>
<div hidden ref="details" .details>

  <fieldset>
    <legend>File Name</legend>
    <input name="name-input" ref="file-name-input" type="text" />
  </fieldset>

  <fieldset>
    <legend>File Size</legend>
    <div loc="textContent: fileSize"></div>
  </fieldset>

  <fieldset>
    <legend>CDN URL</legend>
    <a target="_blanc" loc="textContent: cdnUrl; @href: cdnUrl;"></a>
  </fieldset>

  <div loc="textContent: errorTxt;"></div>

</div>
<div ref="viewport" .viewport>
  <uc-editable-canvas ref="canvas"></uc-editable-canvas>
</div>
<div .toolbar>
  <button .back-btn loc="onclick: on.back">
    <uc-icon-ui name="back"></uc-icon-ui>
  </button>
  <button .edit-btn loc="onclick: on.edit">
    <uc-icon-ui name="edit"></uc-icon-ui>
  </button>
  <button .remove-btn loc="onclick: on.remove">
    <uc-icon-ui name="remove"></uc-icon-ui>
  </button>
</div>
`;
