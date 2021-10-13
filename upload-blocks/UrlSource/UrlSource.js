import { BlockComponent } from '../BlockComponent/BlockComponent.js';
import { uploadFile } from '../../web_modules/upload-client.js';

export class UrlSource extends BlockComponent {
  init$ = {
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
      this.$['*currentActivity'] = BlockComponent.activities.UPLOAD_LIST;
    },
  };
}

UrlSource.template = /*html*/ `
<input placeholder="https://..." .url-input type="text" ref="input" />
<button .url-upload-btn set="onclick: onUpload"></button>
`;
