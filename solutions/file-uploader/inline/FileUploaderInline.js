// @ts-check
import { ActivityBlock } from '../../../abstract/ActivityBlock.js';
import { SolutionBlock } from '../../../abstract/SolutionBlock.js';

export class FileUploaderInline extends SolutionBlock {
  constructor() {
    super();

    this.init$ = {
      ...this.init$,
      couldBackHistory: false,
    };
  }
  shadowReadyCallback() {
    /** @type {import('../../../abstract/UploaderBlock.js').UploaderBlock} */
    const uBlock = this.ref.uBlock;
    this.sub('*currentActivity', (val) => {
      if (!val) {
        this.$['*currentActivity'] = uBlock.initActivity || ActivityBlock.activities.START_FROM;
      }
    });

    this.sub('*uploadList', (list) => {
      if (
        list?.length > 0 &&
        this.$['*currentActivity'] === (uBlock.initActivity || ActivityBlock.activities.START_FROM)
      ) {
        this.$['*currentActivity'] = ActivityBlock.activities.UPLOAD_LIST;
      }
    });

    this.sub('*history', (history) => (this.$['couldBackHistory'] = history.length > 1));
  }
}

FileUploaderInline.template = /* HTML */ ` <lr-start-from>
    <lr-drop-area with-icon clickable></lr-drop-area>
    <lr-source-list wrap></lr-source-list>
    <button
      type="button"
      l10n="cancel"
      class="cancel-btn secondary-btn"
      set="onclick: *historyBack; @hidden: !couldBackHistory"
    ></button>
    <lr-copyright></lr-copyright>
  </lr-start-from>
  <lr-upload-list ref="uBlock"></lr-upload-list>
  <lr-camera-source></lr-camera-source>
  <lr-url-source></lr-url-source>
  <lr-external-source></lr-external-source>
  <lr-message-box></lr-message-box>
  <lr-progress-bar></lr-progress-bar>
  <lr-cloud-image-editor-activity></lr-cloud-image-editor-activity>`;
