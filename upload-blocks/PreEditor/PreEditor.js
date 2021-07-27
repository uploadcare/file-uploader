import { BaseComponent } from '../../symbiote/core/BaseComponent.js';

const ICONS = {
  back: 'M15.41,16.58L10.83,12L15.41,7.41L14,6L8,12L14,18L15.41,16.58Z',
  remove: 'M2,6V8H14V6H2M2,10V12H11V10H2M14.17,10.76L12.76,12.17L15.59,15L12.76,17.83L14.17,19.24L17,16.41L19.83,19.24L21.24,17.83L18.41,15L21.24,12.17L19.83,10.76L17,13.59L14.17,10.76M2,14V16H11V14H2Z',
  edit: 'M22.7 14.3L21.7 15.3L19.7 13.3L20.7 12.3C20.8 12.2 20.9 12.1 21.1 12.1C21.2 12.1 21.4 12.2 21.5 12.3L22.8 13.6C22.9 13.8 22.9 14.1 22.7 14.3M13 19.9V22H15.1L21.2 15.9L19.2 13.9L13 19.9M11.21 15.83L9.25 13.47L6.5 17H13.12L15.66 14.55L13.96 12.29L11.21 15.83M11 19.9V19.05L11.05 19H5V5H19V11.31L21 9.38V5C21 3.9 20.11 3 19 3H5C3.9 3 3 3.9 3 5V19C3 20.11 3.9 21 5 21H11V19.9Z',
  detail: 'M5,3C3.89,3 3,3.89 3,5V19C3,20.11 3.89,21 5,21H19C20.11,21 21,20.11 21,19V5C21,3.89 20.11,3 19,3H5M5,5H19V19H5V5M7,7V9H17V7H7M7,11V13H17V11H7M7,15V17H14V15H7Z',
};

export class PreEditor extends BaseComponent {

  constructor() {
    super();
    this.initLocalState({
      'on.back': () => {
        this.externalState.pub('backTrigger', {});
      },
      'on.remove': () => {
        /** @type {File[]} */
        this.collection.remove(this.entry.__ctxId);
        this.externalState.pub('backTrigger', {});
      },
      'on.edit': () => {

      },
    });
  }

  _renderPreview(imgFile) {
    /** @type {HTMLCanvasElement} */
    // @ts-ignore
    this._canv = this.ref.canvas;
    this._ctx = this._canv.getContext('2d');
    let img = new Image();
    let url = URL.createObjectURL(imgFile);
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
    this.externalState.sub('uploadCollection', (collection) => {
      /** @type {import('../../symbiote/core/TypedCollection.js').TypedCollection} */
      this.collection = collection;
    });
    this.externalState.sub('focusedEntry', (/** @type {import('../../symbiote/core/TypedState.js').TypedState} */ entry) => {
      if (this._ctx) {
        this._ctx.clearRect(0, 0, this._canv.width, this._canv.height);
      }
      if (!entry) {
        return;
      }
      this.entry = entry;
      /** @type {File} */
      this._file = entry.getValue('file');
      if (this._file.type.includes('image')) {
        this._renderPreview(this._file);
      }
      this.ref['file-name-input']['value'] = this._file.name;
      this.ref['file-name-input'].oninput = () => {
        Object.defineProperty(this._file, 'name', {
          writable: true,
          value: this.ref['file-name-input']['value'],
        });
      };

    });
  }

}

PreEditor.template = /*html*/ `
<div></div>
<div -viewport->
  <canvas ref="canvas"></canvas>
  <div -meta-editor->
    <input ref="file-name-input" type="text" />
  </div>
</div>
<div -toolbar->
  <button -back-btn- loc="onclick: on.back">
    <icon-ui path="${ICONS.back}"></icon-ui>
  </button>
  <div></div>
  <button -remove-btn- loc="onclick: on.remove">
    <icon-ui path="${ICONS.remove}"></icon-ui>
  </button>
  <button -detail-btn- loc="onclick: on.details">
    <icon-ui path="${ICONS.detail}"></icon-ui>
  </button>
  <button -edit-btn- loc="onclick: on.edit">
    <icon-ui path="${ICONS.edit}"></icon-ui>
  </button>
</div>
`;

