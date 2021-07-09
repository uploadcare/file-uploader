import { AppComponent } from '../AppComponent/AppComponent.js';

export class SystemCall extends AppComponent {
  constructor() {
    super();
    this.addToAppState({
      multiple: true,
      accept: 'image/*',
      systemTrigger: null,
    });
  }

  connectedCallback() {
    super.connectedCallback();
    if (!this._hasSubs) {
      this.appState.sub('systemTrigger', (val) => {
        if (!val) {
          return;
        }
        this.ref.input.dispatchEvent(new MouseEvent('click'));
      });
      this.ref.input.onchange = () => {
        this.appState.pub('files', [...this.ref.input['files']]);
      };
      this._hasSubs = true;
    }
  }
}

SystemCall.template = /*html*/ `
<input 
  hidden
  ref="input"
  type="file"
  app="@multiple: multiple; @accept: accept">`;