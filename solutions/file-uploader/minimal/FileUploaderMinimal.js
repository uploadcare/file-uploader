import { SolutionBlock } from '../../../abstract/SolutionBlock.js';
import { ActivityBlock } from '../../../abstract/ActivityBlock.js';

export class FileUploaderMinimal extends SolutionBlock {
  pauseRender = true;

  init$ = {
    ...this.ctxInit,
    selectClicked: () => {
      this.ref.uBlock.openSystemDialog();
    },
  };

  shadowReadyCallback() {
    /** @type {import('../../../abstract/UploaderBlock.js').UploaderBlock} */
    const uBlock = this.ref.uBlock;
    this.sub('*currentActivity', (val) => {
      if (!val) {
        this.$['*currentActivity'] = uBlock.initActivity || ActivityBlock.activities.START_FROM;
      }
    });

    this.sub('*uploadList', (list) => {
      if (list?.length === 0) {
        this.$['*currentActivity'] = uBlock.initActivity || ActivityBlock.activities.START_FROM;
      }
    });
  }
}

FileUploaderMinimal.template = /* HTML */ `
  <lr-start-from>
    <lr-drop-area clickable l10n="choose-file"></lr-drop-area>
  </lr-start-from>
  <lr-upload-list ref="uBlock"></lr-upload-list>
  <lr-message-box></lr-message-box>
`;
