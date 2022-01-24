import { BlockComponent } from '../BlockComponent/BlockComponent.js';

export class UrlSource extends BlockComponent {
  activityType = BlockComponent.activities.URL;

  init$ = {
    onUpload: () => {
      let url = this.ref.input['value'];
      this.uploadCollection.add({
        externalUrl: url,
      });
      this.$['*currentActivity'] = BlockComponent.activities.UPLOAD_LIST;
    },
    onCancel: () => {
      this.set$({
        '*currentActivity': BlockComponent.activities.SOURCE_SELECT,
      });
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
<input placeholder="https://..." .url-input type="text" ref="input" />
<button
  class="url-upload-btn primary-btn "
  set="onclick: onUpload">
</button>
<button
  class="cancel-btn secondary-btn"
  set="onclick: onCancel"
  l10n="cancel">
</button>
`;
