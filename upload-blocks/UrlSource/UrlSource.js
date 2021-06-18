import { AppComponent } from '../AppComponent/AppComponent.js';
import { UploadClientLight } from '../../lib/UploadClientLight.js';

export class UrlSource extends AppComponent {
  constructor() {
    super();
    this.initLocalState({
      onUpload: async () => {
        let info = await UploadClientLight.uploadFromUrl(this.refs.input['value'], this.appState.read('pubkey'), this.refs.input['value']);
        let outArr = this.appState.read('uploadOutput');
        outArr.push(info.cdnUrl);
        this.appState.pub('uploadOutput', [...outArr]);
        this.appState.pub('modalActive', false);
        console.log(info);
      },
    });
    this.addToAppState({
      urlActive: false,
    });
  }

  connectedCallback() {
    super.connectedCallback();
    this.render();
    this.appState.sub('urlActive', (val) => {
      if (val) {
        this.appState.pub('listActive', false);
        this.appState.pub('modalActive', true);
        this.appState.pub('modalCaption', 'Upload from URL');
        this.setAttribute('active', '');
      } else {
        this.removeAttribute('active');
      }
    });
  }
}

UrlSource.template = /*html*/ `
<input type="text" ref="input" />
<button sub="onclick: onUpload">Upload</button>
`;
