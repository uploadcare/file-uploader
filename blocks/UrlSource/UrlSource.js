import { Block } from '../../abstract/Block.js';

export class UrlSource extends Block {
  activityType = Block.activities.URL;

  init$ = {
    importDisabled: true,
    onUpload: () => {
      let url = this.ref.input['value'];
      this.uploadCollection.add({
        externalUrl: url,
      });
      this.$['*currentActivity'] = Block.activities.UPLOAD_LIST;
    },
    onCancel: () => {
      this.set$({
        '*currentActivity': Block.activities.SOURCE_SELECT,
      });
    },
    onInput: (e) => {
      let value = e.target.value;
      this.set$({ importDisabled: !value });
    },
  };

  initCallback() {
    this.registerActivity(this.activityType, () => {
      this.set$({
        '*activityCaption': this.l10n('caption-from-url'),
        '*activityIcon': 'url',
      });
    });
  }
}

UrlSource.template = /*html*/ `
<input placeholder="https://..." .url-input type="text" ref="input" set="oninput: onInput"/>
<button
  class="url-upload-btn primary-btn"
  set="onclick: onUpload; @disabled: importDisabled">
</button>
<button
  class="cancel-btn secondary-btn"
  set="onclick: onCancel"
  l10n="cancel">
</button>
`;
