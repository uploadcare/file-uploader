import { BlockComponent } from '../BlockComponent/BlockComponent.js';

export class MessageBox extends BlockComponent {
  constructor() {
    super();
    this.initLocalState({
      iconName: 'info',
      captionTxt: 'Message caption',
      msgTxt: 'Message...',

      'on.close': () => {
        this.removeAttribute('active');
      },
    });
  }

  initCallback() {
    this.addToExternalState({
      message: null,
    });
    this.sub('external', 'message', (msg) => {
      if (msg) {
        this.multiPub('local', {
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
  <uc-icon loc="@name: iconName"></uc-icon>
  <div .caption loc="textContent: captionTxt"></div>
  <button loc="onclick: on.close">
    <uc-icon name="close"></uc-icon>
  </button>
</div>
<div .msg loc="textContent: msgTxt"></div>
`;
