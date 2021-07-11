import { AppComponent } from '../AppComponent/AppComponent.js';
import { UploadClientLight } from '../../common-utils/UploadClientLight.js';

export class UrlSource extends AppComponent {
  constructor() {
    super();
    this.initLocalState({
      onUpload: async () => {
        let info = await UploadClientLight.uploadFromUrl(this.ref.input['value'], this.appState.read('pubkey'), this.ref.input['value']);
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
    if (!this.hasSubs) {
      super.connectedCallback();
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
      this.hasSubs = true;
    }
  }
}

UrlSource.template = /*html*/ `
<input placeholder="https://..." -url-input- type="text" ref="input" />
<button -url-upload-btn- sub="onclick: onUpload"></button>
`;
