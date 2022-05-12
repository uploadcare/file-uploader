import { Block } from '../../abstract/Block.js';

/**
 * @typedef {{
 *   importDisabled: Boolean;
 *   onUpload: () => void;
 *   onCancel: () => void;
 *   onInput: (e: InputEvent) => void;
 * }} State
 */

/**
 * @typedef {State &
 *   Partial<import('../ActivityCaption/ActivityCaption').State> &
 *   Partial<import('../ActivityIcon/ActivityIcon').State>} UrlSourceState
 */

/** @extends {Block<UrlSourceState>} */
export class UrlSource extends Block {
  activityType = Block.activities.URL;

  /** @type {State} */
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
      this.cancelFlow();
    },
    onInput: (e) => {
      let value = /** @type {HTMLInputElement} */ (e.target).value;
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
