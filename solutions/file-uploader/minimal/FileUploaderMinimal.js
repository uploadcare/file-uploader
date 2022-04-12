import { Block } from '../../../blocks/index.js';

export class FileUploaderMinimal extends Block {
  init$ = {
    selectClicked: () => {
      this.openSystemDialog();
    },
  };
}

FileUploaderMinimal.template = /*html*/ `
  <uc-start-from>
    <uc-drop-area>
      <button 
        l10n="drop-files-here"
        set="onclick: selectClicked">
      </button>
    </uc-drop-area>
  </uc-start-from>
  <uc-upload-list></uc-upload-list>
  <uc-message-box></uc-message-box>
`;
