import { UploaderBlock } from '../../abstract/UploaderBlock.js';
import { ActivityBlock } from '../../abstract/ActivityBlock.js';

export class UrlSource extends UploaderBlock {
  activityType = ActivityBlock.activities.URL;

  init$ = {
    ...this.ctxInit,
    importDisabled: true,
    onUpload: () => {
      let url = this.ref.input['value'];
      this.uploadCollection.add({
        externalUrl: url,
      });
      this.$['*currentActivity'] = ActivityBlock.activities.UPLOAD_LIST;
    },
    onCancel: () => {
      this.historyBack();
    },
    onInput: (e) => {
      let value = /** @type {HTMLInputElement} */ (e.target).value;
      this.set$({ importDisabled: !value });
    },
  };

  initCallback() {
    super.initCallback();
    this.registerActivity(this.activityType);
  }
}

UrlSource.template = /* HTML */ `
  <lr-activity-header>
    <button type="button" class="mini-btn close-btn" set="onclick: *historyBack">
      <lr-icon name="back"></lr-icon>
    </button>
    <div>
      <lr-icon name="url"></lr-icon>
      <span l10n="caption-from-url"></span>
    </div>
    <button type="button" class="mini-btn close-btn" set="onclick: *closeModal">
      <lr-icon name="close"></lr-icon>
    </button>
  </lr-activity-header>
  <div class="content">
    <input placeholder="https://" class="url-input" type="text" ref="input" set="oninput: onInput" />
    <button
      type="button"
      class="url-upload-btn primary-btn"
      set="onclick: onUpload; @disabled: importDisabled"
    ></button>
  </div>
`;
