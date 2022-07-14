import { ShadowWrapper } from '../../../blocks/ShadowWrapper/ShadowWrapper.js';
import { ActivityBlock } from '../../../abstract/ActivityBlock.js';

export class FileUploaderMinimal extends ShadowWrapper {
  pauseRender = true;

  init$ = {
    ...this.init$,
    selectClicked: () => {
      this.ref.uBlock.openSystemDialog();
    },
  };

  shadowReadyCallback() {
    this.$['*currentActivity'] = ActivityBlock.activities.START_FROM;
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
  <lr-upload-list ref="uBlock"></lr-upload-list>
  <lr-message-box></lr-message-box>
`;
