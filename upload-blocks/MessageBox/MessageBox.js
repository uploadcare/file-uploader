import { BaseComponent } from '../../symbiote/core/BaseComponent.js';

export class MessageBox extends BaseComponent {

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
    this.externalState?.sub('message', (msg) => {
      if (msg) {
        this.localState.multiPub({
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
<div -heading->
  <icon-ui loc="@name: iconName"></icon-ui>
  <div -caption- loc="textContent: captionTxt"></div>
  <button loc="onclick: on.close">
    <icon-ui name="close"></icon-ui>
  </button>
</div>
<div -msg- loc="textContent: msgTxt"></div>
`;