import { BaseComponent } from '../../symbiote/core/BaseComponent.js';

const ACTIVE_ATTR = 'active';

export class ActivityMngr extends BaseComponent {

  readyCallback() {
    this.addToExternalState({
      currentActivity: '',
      history: [],
      backTrigger: null,
    });
    this.externalState.sub('currentActivity', (val) => {
      /** @type {String[]} */
      let history = this.externalState.read('history');
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
    this.externalState.sub('backTrigger', (val) => {
      /** @type {String[]} */
      let history = this.externalState.read('history');
      history.pop();
      let prevActivity = history.pop();
      this.externalState.pub('currentActivity', prevActivity);
      if (history.length > 10) {
        history = history.slice(history.length - 11, history.length - 1);
      }
      this.externalState.pub('history', history);
      // console.log(history)
    });

  }
}

