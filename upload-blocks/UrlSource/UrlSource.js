import { BlockComponent } from '../BlockComponent/BlockComponent.js';
import { uploadFile } from '../../web_modules/upload-client.js';

export class UrlSource extends BlockComponent {
  constructor() {
    super();
    this.initLocalState({
      onUpload: async () => {
        let url = this.ref.input['value'];
        let pubkey = this.config.PUBKEY;
        let entry = this.uploadCollection.add({
          externalUrl: url,
        });
        // @ts-ignore
        let fileInfo = await uploadFile(url, {
          publicKey: pubkey,
          onProgress: (progress) => {
            let percentage = progress.value;
            entry.setValue('uploadProgress', percentage);
          },
        });
        console.log(fileInfo);
        entry.setMultipleValues({
          uuid: fileInfo.uuid,
          fileName: fileInfo.name,
          fileSize: fileInfo.size,
          isImage: fileInfo.isImage,
          mimeType: fileInfo.mimeType,
        });
        this.pub('external', 'currentActivity', 'upload-list');
      },
    });
    this.addToExternalState({
      urlActive: false,
    });
  }

  initCallback() {
    this.sub('external', 'urlActive', (val) => {
      if (val) {
        this.multiPub('external', {
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
<input placeholder="https://..." .url-input type="text" ref="input" />
<button .url-upload-btn loc="onclick: onUpload"></button>
`;
