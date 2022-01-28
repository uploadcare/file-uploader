import { BlockComponent } from '../BlockComponent/BlockComponent.js';

export class UiMessage {
  caption = '';
  text = '';
  iconName = '';
  isError = false;
}

export class MessageBox extends BlockComponent {
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
  <uc-icon set="@name: iconName"></uc-icon>
  <div class="caption">{{captionTxt}}</div>
  <button set="onclick: onClose">
    <uc-icon name="close"></uc-icon>
  </button>
</div>
<div class="msg">{{msgTxt}}</div>
`;
