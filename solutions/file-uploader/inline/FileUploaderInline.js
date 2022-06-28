import { UploaderBlock } from '../../../abstract/UploaderBlock.js';
import { ActivityBlock } from '../../../abstract/ActivityBlock.js';

export class FileUploaderInline extends UploaderBlock {
  init$ = {
    ...this.init$,
    dropAreaHidden: false,
  };

  initCallback() {
    this.sub('*currentActivity', (val) => {
      if (!val) {
        this.$['*currentActivity'] = this.initActivity || ActivityBlock.activities.START_FROM;
      }
    });
    if (this.sourceList.length === 1 && !this.sourceList.includes(UploaderBlock.sourceTypes.LOCAL)) {
      this.$.dropAreaHidden = true;
    }
  }
}

FileUploaderInline.template = /*html*/ `
<lr-start-from>
  <lr-source-list wrap></lr-source-list>
  <lr-drop-area set="@hidden: dropAreaHidden"></lr-drop-area>
</lr-start-from>
<lr-upload-list></lr-upload-list>
<lr-camera-source></lr-camera-source>
<lr-url-source></lr-url-source>
<lr-external-source></lr-external-source>
<lr-upload-details></lr-upload-details>
<lr-confirmation-dialog></lr-confirmation-dialog>
<lr-message-box></lr-message-box>
<lr-progress-bar></lr-progress-bar>
<lr-cloud-image-editor></lr-cloud-image-editor>`;
