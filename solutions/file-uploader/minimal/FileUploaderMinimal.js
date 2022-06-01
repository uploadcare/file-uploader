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
  <uc-start-from>
    <uc-drop-area>
      <button
        type="button"
        l10n="drop-files-here"
        set="onclick: selectClicked">
      </button>
    </uc-drop-area>
  </uc-start-from>
  <uc-upload-list></uc-upload-list>
  <uc-message-box></uc-message-box>
`;
