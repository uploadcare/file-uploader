import { SolutionBlock } from '../../../abstract/SolutionBlock.js';

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
        uBlock.initFlow();
      }
    });

    this.sub('*uploadList', (list) => {
      if (list?.length === 0) {
        uBlock.initFlow();
      }
    });
  }
}

FileUploaderMinimal.template = /* HTML */ `
  <lr-start-from>
    <lr-drop-area clickable l10n="choose-file"></lr-drop-area>
    <lr-copyright></lr-copyright>
  </lr-start-from>
  <lr-upload-list ref="uBlock"></lr-upload-list>
  <lr-message-box></lr-message-box>
`;
