import { ShadowWrapper } from '../../../blocks/ShadowWrapper/ShadowWrapper.js';
import { ActivityBlock } from '../../../abstract/ActivityBlock.js';
import { UploaderBlock } from '../../../abstract/UploaderBlock.js';

export class FileUploaderInline extends ShadowWrapper {
  init$ = {
    ...this.init$,
    dropAreaHidden: false,
  };

  shadowReadyCallback() {
    this.sub('*currentActivity', (val) => {
      if (!val) {
        this.$['*currentActivity'] = this.ref.uBlock.initActivity || ActivityBlock.activities.START_FROM;
      }
    });
    if (
      this.ref.uBlock.sourceList.length === 1 &&
      !this.ref.uBlock.sourceList.includes(UploaderBlock.sourceTypes.LOCAL)
    ) {
      this.$.dropAreaHidden = true;
    }
  }
}

FileUploaderInline.template = /*html*/ `
<lr-start-from>
  <lr-source-list wrap></lr-source-list>
  <lr-drop-area set="@hidden: dropAreaHidden"></lr-drop-area>
</lr-start-from>
<lr-upload-list ref="uBlock"></lr-upload-list>
<lr-camera-source></lr-camera-source>
<lr-url-source></lr-url-source>
<lr-external-source></lr-external-source>
<lr-upload-details></lr-upload-details>
<lr-confirmation-dialog></lr-confirmation-dialog>
<lr-message-box></lr-message-box>
<lr-progress-bar></lr-progress-bar>
<lr-cloud-image-editor></lr-cloud-image-editor>`;
