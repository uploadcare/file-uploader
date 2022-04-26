import { Block } from '../../../abstract/Block.js';

export class FileUploaderInline extends Block {
  initCallback() {
    this.sub('*currentActivity', (val) => {
      if (!val) {
        this.$['*currentActivity'] = this.initActivity || Block.activities.START_FROM;
      }
    });
  }
}

FileUploaderInline.template = /*html*/ `
<uc-start-from>
  <uc-source-list wrap></uc-source-list>
  <uc-drop-area></uc-drop-area>
</uc-start-from>
<uc-upload-list></uc-upload-list>
<uc-camera-source></uc-camera-source>
<uc-url-source></uc-url-source>
<uc-external-source></uc-external-source>
<uc-upload-details></uc-upload-details>
<uc-confirmation-dialog></uc-confirmation-dialog>
<uc-message-box></uc-message-box>
<uc-progress-bar></uc-progress-bar>
<uc-cloud-image-editor></uc-cloud-image-editor>
`;
