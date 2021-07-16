import { AppComponent } from '../AppComponent/AppComponent.js';

const ICONS = {
  back: 'M15.41,16.58L10.83,12L15.41,7.41L14,6L8,12L14,18L15.41,16.58Z',
  remove: 'M2,6V8H14V6H2M2,10V12H11V10H2M14.17,10.76L12.76,12.17L15.59,15L12.76,17.83L14.17,19.24L17,16.41L19.83,19.24L21.24,17.83L18.41,15L21.24,12.17L19.83,10.76L17,13.59L14.17,10.76M2,14V16H11V14H2Z',
  edit: 'M22.7 14.3L21.7 15.3L19.7 13.3L20.7 12.3C20.8 12.2 20.9 12.1 21.1 12.1C21.2 12.1 21.4 12.2 21.5 12.3L22.8 13.6C22.9 13.8 22.9 14.1 22.7 14.3M13 19.9V22H15.1L21.2 15.9L19.2 13.9L13 19.9M11.21 15.83L9.25 13.47L6.5 17H13.12L15.66 14.55L13.96 12.29L11.21 15.83M11 19.9V19.05L11.05 19H5V5H19V11.31L21 9.38V5C21 3.9 20.11 3 19 3H5C3.9 3 3 3.9 3 5V19C3 20.11 3.9 21 5 21H11V19.9Z',
};

export class PreEditor extends AppComponent {

  constructor() {
    super();
    this.initLocalState({
      'on.back': () => {
        let prev = this.appState.read('prevActivity');
        if (prev) {
          this.appState.pub('currentActivity', 'upload-list');
        }
      },
      'on.remove': () => {
        /** @type {File[]} */
        let files = this.appState.read('files');
        this.appState.pub('files', files.filter((file) => {
          return file !== this._file;
        }));
        let prev = this.appState.read('prevActivity');
        if (prev) {
          this.appState.pub('currentActivity', 'upload-list');
        }
      },
      'on.edit': () => {

      },
    });
  }

  connectedCallback() {
    this.addToAppState({
      focusedFile: null,
      prevActivity: null,
    });
    super.connectedCallback();
    this.appState.sub('focusedFile', (file) => {
      if (this._ctx) {
        this._ctx.clearRect(0, 0, this._canv.width, this._canv.height);
      }
      if (!file) {
        return;
      }
      /** @type {File} */
      this._file = file;
      this.ref['file-name-input']['value'] = this._file.name;
      /** @type {HTMLCanvasElement} */
      // @ts-ignore
      this._canv = this.ref.canvas;
      this._ctx = this._canv.getContext('2d');
      let img = new Image();
      let url = URL.createObjectURL(file);
      img.onload = () => {
        this._canv.height = img.height;
        this._canv.width = img.width;
        this._ctx.drawImage(img, 0, 0);
      };
      img.src = url;
    });
  }

}

PreEditor.template = /*html*/ `
<div -viewport->
  <canvas ref="canvas"></canvas>
  <div -meta-editor->
    <input ref="file-name-input" type="text" />
    <input type="text" />
  </div>
</div>
<div -toolbar->
  <button -back-btn- sub="onclick: on.back">
    <icon-ui path="${ICONS.back}"></icon-ui>
  </button>
  <div></div>
  <button -remove-btn- sub="onclick: on.remove">
    <icon-ui path="${ICONS.remove}"></icon-ui>
  </button>
  <button -edit-btn- sub="onclick: on.edit">
    <icon-ui path="${ICONS.edit}"></icon-ui>
  </button>
</div>
`;

