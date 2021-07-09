import { AppComponent } from '../AppComponent/AppComponent.js';

const SOURCES = ['local', 'camera', 'url', 'custom'];

export class SourceSelect extends AppComponent {
  handleSource(source) {
    let handlers = {
      local: () => {
        this.ref['input-el'].dispatchEvent(new MouseEvent('click'));
      },
      camera: () => {
        this.appState.add('cameraActive', true);
      },
      url: () => {
        this.appState.add('urlActive', true);
      },
      custom: () => {
        console.log('CUSTOM SOURCE');
      },
    };
    handlers[source]?.();
  }

  constructor() {
    super();
    this.currentSource = SOURCES[0];
    this.initLocalState({
      btnTxt: 'Upload from:',
      selectChanged: () => {
        this.currentSource = this.ref['select-el']['value'];
        this.handleSource(this.currentSource);
      },
      btnClicked: () => {
        this.handleSource(this.currentSource);
      },
      onFiles: () => {
        this.appState.pub('files', [...this.ref['input-el']['files']]);
      },
    });
    this.addToAppState({
      files: null,
      multiple: true,
    });
  }

  connectedCallback() {
    if (this.connectedOnce) {
      return;
    }
    this._initChildren = [...this.children];
    super.connectedCallback();
    this._initChildren.forEach((el) => {
      this.ref['select-el'].appendChild(el);
    });
    this.currentSource = this.ref['select-el'].querySelector('option')?.getAttribute('value');
    if (!this.hasAttribute('multiple')) {
      this.appState.pub('multiple', false);
    }
  }

  static get observedAttributes() {
    return ['btn-txt', 'multiple', 'accept'];
  }
}

SourceSelect.template = /*html*/ `
<button ref="init-btn" sub="textContent: btnTxt; onclick: btnClicked"></button>
<label>
  <select ref="select-el" sub="onchange: selectChanged"><select>
</label>
<input type="file" hidden ref="input-el" app="@multiple: multiple" sub="onchange: onFiles">
`;
