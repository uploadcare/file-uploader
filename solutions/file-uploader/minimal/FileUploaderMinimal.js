import { UploaderBlock } from '../../../abstract/UploaderBlock.js';
import { ActivityBlock } from '../../../abstract/ActivityBlock.js';

export class FileUploaderMinimal extends UploaderBlock {
  init$ = {
    ...this.init$,
    selectClicked: () => {
      this.openSystemDialog();
    },
  };

  initCallback() {
    this.$['*currentActivity'] = this.initActivity || ActivityBlock.activities.START_FROM;
  }
}

FileUploaderMinimal.template = /*html*/ `
  <lr-start-from>
    <lr-drop-area>
      <button
        type="button"
        l10n="drop-files-here"
        set="onclick: selectClicked">
      </button>
    </lr-drop-area>
  </lr-start-from>
  <lr-upload-list></lr-upload-list>
  <lr-message-box></lr-message-box>
`;
