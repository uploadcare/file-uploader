import { ActivityBlock } from '../../../abstract/ActivityBlock.js';
import { SolutionBlock } from '../../../abstract/SolutionBlock.js';

export class FileUploaderMinimal extends SolutionBlock {
  pauseRender = true;

  shadowReadyCallback() {
    /** @type {import('../../../abstract/UploaderBlock.js').UploaderBlock} */
    const uBlock = this.ref.uBlock;
    this.sub('*currentActivity', (val) => {
      if (!val) {
        this.$['*currentActivity'] = uBlock.initActivity || ActivityBlock.activities.START_FROM;
      }
    });

    this.sub('*uploadList', (list) => {
      if (list?.length > 0) {
        this.$['*currentActivity'] = ActivityBlock.activities.UPLOAD_LIST;
      } else {
        this.$['*currentActivity'] = uBlock.initActivity || ActivityBlock.activities.START_FROM;
      }
    });

    this.subConfigValue('sourceList', (sourceList) => {
      if (sourceList !== 'local') {
        this.cfg.sourceList = 'local';
      }
    });

    this.subConfigValue('confirmUpload', (confirmUpload) => {
      if (confirmUpload !== false) {
        this.cfg.confirmUpload = false;
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
`;
