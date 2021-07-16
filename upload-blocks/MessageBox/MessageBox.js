import { AppComponent } from '../AppComponent/AppComponent.js';

const ICONS = {
  info: 'M11,9H13V7H11M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M11,17H13V11H11V17Z',
  err: 'M13,13H11V7H13M13,17H11V15H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z',
  close: 'M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z',
};

export class MessageBox extends AppComponent {

  constructor() {
    super();
    this.initLocalState({
      iconPath: ICONS.info,
      captionTxt: 'Message caption',
      msgTxt: 'Message...',

      'on.close': () => {
        this.removeAttribute('active');
      },
    });

  }

  connectedCallback() {
    if (!this._hasSubs) {
      super.connectedCallback();
      this.addToAppState({
        message: null,
      });
      this.appState?.sub('message', (msg) => {
        if (msg) {
          this.localState.pub('captionTxt', msg.caption);
          this.localState.pub('msgTxt', msg.text);
          this.localState.pub('iconPath', msg.isError ? ICONS.err : ICONS.info);
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
      this._hasSubs = true;
    }
  }

}

MessageBox.template = /*html*/ `
<div -heading->
  <icon-ui sub="@path: iconPath"></icon-ui>
  <div -caption- sub="textContent: captionTxt"></div>
  <button sub="onclick: on.close">
    <icon-ui path="${ICONS.close}"></icon-ui>
  </button>
</div>
<div -msg- sub="textContent: msgTxt"></div>
`;