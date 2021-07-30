import { BaseComponent } from '../../symbiote/core/BaseComponent.js';
import { uploadFromUrl, getInfo } from '../../common-utils/UploadClientLight.js';

export class UrlSource extends BaseComponent {
  constructor() {
    super();
    this.initLocalState({
      onUpload: async () => {
        let url = this.ref.input['value'];
        let pubkey = this.externalState.read('pubkey')
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
            entry.setMultipleValues({
              uuid: fileInfo.uuid,
              fileName: fileInfo.filename,
              fileSize: fileInfo.size,
              isImage: fileInfo.is_image,
              mimeType: fileInfo.mime_type,
            });
            this.externalState.pub('currentActivity', 'upload-list');
          }
        });
      },
    });
    this.addToExternalState({
      urlActive: false,
    });
  }

  initCallback() {
    this.externalState.sub('uploadCollection', (collection) => {
      /** @type {import('../../symbiote/core/TypedCollection.js').TypedCollection} */
      this.collection = collection;
    });
    this.externalState.sub('urlActive', (val) => {
      if (val) {
        this.externalState.multiPub({
          modalActive: true,
          modalCaption: 'Upload from URL',
        });
        this.setAttribute('active', '');
      } else {
        this.removeAttribute('active');
      }
    });
  }
}

UrlSource.template = /*html*/ `
<input placeholder="https://..." -url-input- type="text" ref="input" />
<button -url-upload-btn- loc="onclick: onUpload"></button>
`;
