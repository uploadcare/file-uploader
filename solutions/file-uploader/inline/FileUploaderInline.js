import { Block } from '../../../abstract/Block.js';

/**
 * @typedef {{
 *   dropAreaHidden: Boolean;
 * }} State
 */

/** @extends {Block<State>} */
export class FileUploaderInline extends Block {
  init$ = {
    dropAreaHidden: false,
  };

  initCallback() {
    this.sub('*currentActivity', (val) => {
      if (!val) {
        this.$['*currentActivity'] = this.initActivity || Block.activities.START_FROM;
      }
    });
    if (this.sourceList.length === 1 && !this.sourceList.includes(Block.sourceTypes.LOCAL)) {
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
