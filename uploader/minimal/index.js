import * as UC from './exports.js';
import { registerBlocks } from '../../upload-blocks/registerBlocks.js';

registerBlocks(UC);

export class Uploader extends UC.BlockComponent {
  init$ = {
    '*currentActivity': 'source-select',
    selectClicked: (e) => {
      e.preventDefault();
      this.openSystemDialog();
    },
  };
}

Uploader.template = /*html*/ `
<uc-start-from>
  <uc-drop-area>
    <button 
      l10n="select-file"
      set="onclick: selectClicked"></button>
  </uc-drop-area>
</uc-start-from>
<uc-upload-list
  cancel-activity="source-select"
  done-activity="source-select"></uc-upload-list>
<uc-confirmation-dialog></uc-confirmation-dialog>
<uc-message-box></uc-message-box>
<uc-progress-bar></uc-progress-bar>
`;
Uploader.reg('uploader');

export { UC };
