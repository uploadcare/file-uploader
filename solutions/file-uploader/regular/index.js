import * as UC from '../../../blocks/index.js';

UC.registerBlocks(UC);

export class Uploader extends UC.Block {}

Uploader.template = /*html*/ `
<uc-simple-btn></uc-simple-btn>

<uc-modal strokes block-body-scrolling>
  <uc-activity-icon slot="heading"></uc-activity-icon>
  <uc-activity-caption slot="heading"></uc-activity-caption>
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
</uc-modal>

<uc-message-box></uc-message-box>
<uc-progress-bar-common></uc-progress-bar-common>
`;

Uploader.reg('uploader');

export { UC };
