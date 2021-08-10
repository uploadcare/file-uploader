import { BlockComponent } from '../BlockComponent/BlockComponent.js';

const ACTIVE_ATTR = 'active';

export class ActivityMngr extends BlockComponent {

  initCallback() {
    this.addToExternalState({
      currentActivity: '',
      history: [],
      backTrigger: null,
    });
    this.sub('external', 'currentActivity', (val) => {
      /** @type {String[]} */
      let history = this.read('external', 'history');
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
    this.sub('external', 'backTrigger', (val) => {
      /** @type {String[]} */
      let history = this.read('external', 'history');
      history.pop();
      let prevActivity = history.pop();
      this.pub('external', 'currentActivity', prevActivity);
      if (history.length > 10) {
        history = history.slice(history.length - 11, history.length - 1);
      }
      this.pub('external', 'history', history);
      // console.log(history)
    });

  }
}

