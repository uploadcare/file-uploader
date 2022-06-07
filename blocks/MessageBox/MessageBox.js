import { Block } from '../../abstract/Block.js';

export class UiMessage {
  caption = '';
  text = '';
  iconName = '';
  isError = false;
}

/**
 * @typedef {{
 *   iconName: String;
 *   captionTxt: String;
 *   msgTxt: String;
 *   '*message': UiMessage;
 *   onClose: () => void;
 * }} State
 */

/** @extends {Block<State>} */
export class MessageBox extends Block {
  /** @type {State} */
  init$ = {
    iconName: 'info',
    captionTxt: 'Message caption',
    msgTxt: 'Message...',
    '*message': null,
    onClose: () => {
      this.$['*message'] = null;
    },
  };

  initCallback() {
    this.sub('*message', (/** @type {UiMessage} */ msg) => {
      if (msg) {
        this.setAttribute('active', '');
        this.set$({
          captionTxt: msg.caption,
          msgTxt: msg.text,
          iconName: msg.isError ? 'error' : 'info',
        });
        if (msg.isError) {
          this.setAttribute('error', '');
        } else {
          this.removeAttribute('error');
        }
      } else {
        this.removeAttribute('active');
      }
    });
  }
}

MessageBox.template = /*html*/ `
<div class="heading">
  <lr-icon set="@name: iconName"></lr-icon>
  <div class="caption">{{captionTxt}}</div>
  <button type="button" set="onclick: onClose">
    <lr-icon name="close"></lr-icon>
  </button>
</div>
<div class="msg">{{msgTxt}}</div>
`;
