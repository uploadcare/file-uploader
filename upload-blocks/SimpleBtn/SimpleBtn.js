import { AppComponent } from '../AppComponent/AppComponent.js';

export class SimpleBtn extends AppComponent {
  connectedCallback() {
    super.connectedCallback();
    this.onclick = () => {
      this.appState.pub('currentActivity', 'source-select');
      this.appState.pub('modalCaption', 'Select File Source');
      this.appState.pub('modalActive', 'true');
    };
  }
}

SimpleBtn.template = /*html*/ `<button></button>`;