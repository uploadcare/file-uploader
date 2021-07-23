import { AppComponent } from '../AppComponent/AppComponent.js';
import { uploadFromUrl, getInfo } from '../../common-utils/UploadClientLight.js';

export class UrlSource extends AppComponent {
  constructor() {
    super();
    this.initLocalState({
      onUpload: async () => {
        let url = this.ref.input['value'];
        let pubkey = this.appState.read('pubkey')
        let entry = this.collection.add({
          externalUrl: url,
        });
        await uploadFromUrl(url, pubkey, async (info) => {
          if (info.type === 'progress') {
            entry.setValue('uploadProgress', info.progress);
          } 
          if (info.type === 'success') {
            let fileInfo = await getInfo(info.uuid, pubkey);
            console.log(fileInfo);
            entry.setValue('uuid', fileInfo.uuid);
            entry.setValue('fileName', fileInfo.filename);
            entry.setValue('fileSize', fileInfo.size);
            entry.setValue('isImage', fileInfo.is_image);
            entry.setValue('mimeType', fileInfo.mime_type);
            this.appState.pub('currentActivity', 'upload-list');
          }
        });
      },
    });
    this.addToAppState({
      urlActive: false,
    });
  }

  connectedCallback() {
    if (!this.hasSubs) {
      super.connectedCallback();
      this.appState.sub('uploadCollection', (collection) => {
        /** @type {import('../AppComponent/TypedCollection.js').TypedCollection} */
        this.collection = collection;
      });
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
