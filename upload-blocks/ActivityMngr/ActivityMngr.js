import { AppComponent } from '../AppComponent/AppComponent.js';

const ACTIVE_ATTR = 'active';

export class ActivityMngr extends AppComponent {
  connectedCallback() {
    if (!this._hasSubs) {
      this.addToAppState({
        currentActivity: '',
        history: [],
        backTrigger: null,
      });
      super.connectedCallback();
      this.appState.sub('currentActivity', (val) => {
        /** @type {String[]} */
        let history = this.appState.read('history');
        if (this._currentActivity !== val) {
          history.push(val);
        }
        this._currentActivity = val;
        [...this.children].forEach((el) => {
          if (el.getAttribute('activity') === val) {
            el.setAttribute(ACTIVE_ATTR, '');
          } else {
            el.removeAttribute(ACTIVE_ATTR);
          }
        });
      });
      this.appState.sub('backTrigger', (val) => {
        /** @type {String[]} */
        let history = this.appState.read('history');
        history.pop();
        let prevActivity = history.pop();
        this.appState.pub('currentActivity', prevActivity);
        if (history.length > 10) {
          history = history.slice(history.length - 11, history.length - 1);
        }
        this.appState.pub('history', history);
        // console.log(history)
      });
      this._hasSubs = true;
    }
  }
}

