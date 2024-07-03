import { UploaderBlock } from '../../abstract/UploaderBlock.js';
import { ActivityBlock } from '../../abstract/ActivityBlock.js';
import { UploadSource } from '../utils/UploadSource.js';

export class UrlSource extends UploaderBlock {
  couldBeCtxOwner = true;
  activityType = ActivityBlock.activities.URL;

  init$ = {
    ...this.init$,
    importDisabled: true,
    onUpload: (e) => {
      e.preventDefault();

      let url = this.ref.input['value'];
      this.api.addFileFromUrl(url, { source: UploadSource.URL_TAB });
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
    this.registerActivity(this.activityType, {
      onActivate: () => {
        this.ref.input['value'] = '';
        this.ref.input.focus();
      },
    });
  }
}

UrlSource.template = /* HTML */ `
  <lr-activity-header>
    <button type="button" class="uc-mini-btn" set="onclick: *historyBack">
      <lr-icon name="back"></lr-icon>
    </button>
    <div>
      <lr-icon name="url"></lr-icon>
      <span l10n="caption-from-url"></span>
    </div>
    <button type="button" class="uc-mini-btn uc-close-btn" set="onclick: *closeModal">
      <lr-icon name="close"></lr-icon>
    </button>
  </lr-activity-header>
  <form class="uc-content">
    <input placeholder="https://" class="uc-url-input" type="text" ref="input" set="oninput: onInput" />
    <button
      type="submit"
      class="uc-url-upload-btn uc-primary-btn"
      set="onclick: onUpload; @disabled: importDisabled"
      l10n="upload-url"
    ></button>
  </form>
`;
