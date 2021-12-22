import * as UC from './exports.js';
import { registerBlocks } from '../../upload-blocks/registerBlocks.js';

registerBlocks(UC);

export class Uploader extends UC.BlockComponent {}

Uploader.template = /*html*/ `
<uc-activity-icon slot="heading"></uc-activity-icon>
<uc-activity-caption slot="heading"></uc-activity-caption>
<uc-start-from>
  <uc-source-list wrap></uc-source-list>
  <uc-drop-area></uc-drop-area>
</uc-start-from>
<uc-upload-list
  cancel-activity="source-select"
  done-activity="source-select"></uc-upload-list>
<uc-camera-source></uc-camera-source>
<uc-url-source></uc-url-source>
<uc-external-source></uc-external-source>
<uc-upload-details></uc-upload-details>
<uc-confirmation-dialog></uc-confirmation-dialog>
<uc-message-box></uc-message-box>
<uc-progress-bar></uc-progress-bar>
`;
Uploader.reg('uploader');

export { UC };
