import { Block } from '../../../blocks/index.js';

export class FileUploaderMinimal extends Block {
  init$ = {
    '*currentActivity': 'source-select',
    selectClicked: (e) => {
      e.preventDefault();
      this.openSystemDialog();
    },
  };
}

FileUploaderMinimal.template = /*html*/ `
<uc-start-from>
  <uc-drop-area>
    <button 
      l10n="drop-files-here"
      set="onclick: selectClicked"></button>
  </uc-drop-area>
</uc-start-from>
<uc-upload-list 
  cancel-activity="source-select"
  done-activity="source-select">
</uc-upload-list>
<uc-confirmation-dialog></uc-confirmation-dialog>
<uc-message-box></uc-message-box>
`;
