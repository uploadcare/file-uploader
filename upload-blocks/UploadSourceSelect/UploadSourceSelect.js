import { AppComponent } from '../AppComponent/AppComponent.js';

const SOURCES = ['local', 'camera', 'url', 'custom'];

export class UploadSourceSelect extends AppComponent {
  handleSource(source) {
    let handlers = {
      local: () => {
        this.refs['input-el'].dispatchEvent(new MouseEvent('click'));
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
        this.currentSource = this.refs['select-el']['value'];
        this.handleSource(this.currentSource);
      },
      btnClicked: () => {
        this.handleSource(this.currentSource);
      },
      onFiles: () => {
        this.appState.pub('files', [...this.refs['input-el']['files']]);
      },
    });
    this.addToAppState({
      files: null,
      multiple: true,
    });
  }

  connectedCallback() {
    this._initChildren = [];
    this.childNodes.forEach((el) => {
      this._initChildren.push(el);
    });
    super.connectedCallback();
    this.render();
    this._initChildren.forEach((el) => {
      this.refs['select-el'].appendChild(el);
    });
    this.currentSource = this.refs['select-el'].querySelector('option').getAttribute('value');
    if (!this.hasAttribute('multiple')) {
      this.appState.pub('multiple', false);
    }
  }

  attributeChangedCallback(name, oldVal, newVal) {
    // console.log(newVal);
  }

  static get observedAttributes() {
    return ['btn-txt', 'multiple', 'accept'];
  }
}

UploadSourceSelect.template = /*html*/ `
<button ref="init-btn" sub="textContent: btnTxt; onclick: btnClicked"></button>
<label>
  <select ref="select-el" sub="onchange: selectChanged"><select>
</label>
<input type="file" hidden ref="input-el" app="@multiple: multiple" sub="onchange: onFiles">
`;
