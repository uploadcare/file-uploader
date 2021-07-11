import { AppComponent } from '../AppComponent/AppComponent.js';

const ACTIVE_ATTR = 'active';

export class ActivityMngr extends AppComponent {
  connectedCallback() {
    if (!this._hasSubs) {
      this.addToAppState({
        currentActivity: '',
      });
      super.connectedCallback();
      this.appState.sub('currentActivity', (val) => {
        [...this.children].forEach((el) => {
          if (el.getAttribute('activity') === val) {
            el.setAttribute(ACTIVE_ATTR, '');
          } else {
            el.removeAttribute(ACTIVE_ATTR);
          }
        });
      });
      this._hasSubs = true;
    }
  }
}

