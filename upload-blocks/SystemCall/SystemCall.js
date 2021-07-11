import { AppComponent } from '../AppComponent/AppComponent.js';

export class SystemCall extends AppComponent {

  connectedCallback() {
    if (!this._hasSubs) {
      this.addToAppState({
        multiple: true,
        accept: 'image/*',
        files: [],
        systemTrigger: null,
      });
      this.appState.sub('systemTrigger', (val) => {
        if (!val) {
          return;
        }
        this.ref.input.dispatchEvent(new MouseEvent('click'));
      });
      super.connectedCallback();
      this.ref.input.onchange = () => {
        this.appState.pub('files', [...this.ref.input['files']]);
        this.appState.pub('currentActivity', 'upload-list');
        this.appState.pub('modalActive', true);
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