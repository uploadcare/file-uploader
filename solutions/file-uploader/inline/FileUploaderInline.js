import { SolutionBlock } from '../../../abstract/SolutionBlock.js';
import { ActivityBlock } from '../../../abstract/ActivityBlock.js';
import { UploaderBlock } from '../../../abstract/UploaderBlock.js';
export class FileUploaderInline extends SolutionBlock {
  init$ = {
    ...this.ctxInit,
    dropAreaHidden: false,
  };

  shadowReadyCallback() {
    /** @type {import('../../../abstract/UploaderBlock.js').UploaderBlock} */
    const uBlock = this.ref.uBlock;
    this.sub('*currentActivity', (val) => {
      if (!val) {
        this.$['*currentActivity'] = uBlock.initActivity || ActivityBlock.activities.START_FROM;
      }
    });
    window.customElements.whenDefined(uBlock.tagName.toLowerCase()).then(() => {
      if (uBlock.sourceList.length === 1 && !uBlock.sourceList.includes(UploaderBlock.sourceTypes.LOCAL)) {
        this.$.dropAreaHidden = true;
      }
    });
  }
}

FileUploaderInline.template = /* HTML */ ` <lr-start-from>
    <lr-drop-area set="@hidden: dropAreaHidden" big-icon clickable></lr-drop-area>
    <lr-source-list wrap></lr-source-list>
  </lr-start-from>
  <lr-upload-list ref="uBlock"></lr-upload-list>
  <lr-camera-source></lr-camera-source>
  <lr-url-source></lr-url-source>
  <lr-external-source></lr-external-source>
  <lr-confirmation-dialog></lr-confirmation-dialog>
  <lr-message-box></lr-message-box>
  <lr-progress-bar></lr-progress-bar>
  <lr-cloud-image-editor></lr-cloud-image-editor>`;
