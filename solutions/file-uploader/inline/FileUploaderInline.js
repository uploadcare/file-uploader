import { SolutionBlock } from '../../../abstract/SolutionBlock.js';
import { ActivityBlock } from '../../../abstract/ActivityBlock.js';

export class FileUploaderInline extends SolutionBlock {
  init$ = this.ctxInit;

  shadowReadyCallback() {
    /** @type {import('../../../abstract/UploaderBlock.js').UploaderBlock} */
    const uBlock = this.ref.uBlock;
    this.sub('*currentActivity', (val) => {
      if (!val) {
        this.$['*currentActivity'] = uBlock.initActivity || ActivityBlock.activities.START_FROM;
      }
    });
  }
}

FileUploaderInline.template = /* HTML */ ` <lr-start-from>
    <lr-drop-area with-icon clickable></lr-drop-area>
    <lr-source-list wrap></lr-source-list>
    <lr-copyright></lr-copyright>
  </lr-start-from>
  <lr-upload-list ref="uBlock"></lr-upload-list>
  <lr-camera-source></lr-camera-source>
  <lr-url-source></lr-url-source>
  <lr-external-source></lr-external-source>
  <lr-message-box></lr-message-box>
  <lr-progress-bar></lr-progress-bar>
  <lr-cloud-image-editor></lr-cloud-image-editor>`;
