import { BlockComponent } from '../BlockComponent/BlockComponent.js';

export class MessageBox extends BlockComponent {
  init$ = {
    iconName: 'info',
    captionTxt: 'Message caption',
    msgTxt: 'Message...',
    onClose: () => {
      this.removeAttribute('active');
    },
    '*message': null,
  };

  initCallback() {
    this.sub('*message', (msg) => {
      if (msg) {
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
        this.setAttribute('active', msg.text);
      } else {
        this.removeAttribute('active');
      }
    });
  }
}

MessageBox.template = /*html*/ `
<div .heading>
  <uc-icon set="@name: iconName"></uc-icon>
  <div .caption set="textContent: captionTxt"></div>
  <button set="onclick: onClose">
    <uc-icon name="close"></uc-icon>
  </button>
</div>
<div .msg set="textContent: msgTxt"></div>
`;
