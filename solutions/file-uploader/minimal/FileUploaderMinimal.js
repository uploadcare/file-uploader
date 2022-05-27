import { Block } from '../../../abstract/Block.js';

/**
 * @typedef {{
 *   selectClicked: () => void;
 * }} State
 */

/** @extends {Block<State>} */
export class FileUploaderMinimal extends Block {
  init$ = {
    selectClicked: () => {
      this.openSystemDialog();
    },
  };

  initCallback() {
    this.$['*currentActivity'] = this.initActivity || Block.activities.START_FROM;
  }
}

FileUploaderMinimal.template = /*html*/ `
  <lr-start-from>
    <lr-drop-area>
      <button
        l10n="drop-files-here"
        set="onclick: selectClicked">
      </button>
    </lr-drop-area>
  </lr-start-from>
  <lr-upload-list></lr-upload-list>
  <lr-message-box></lr-message-box>
`;
