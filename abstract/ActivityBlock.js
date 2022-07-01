import { Block } from './Block.js';

const ACTIVE_ATTR = 'active';
const ACTIVE_PROP = '___ACTIVITY_IS_ACTIVE___';

export class ActivityBlock extends Block {
  init$ = {
    ...this.init$,
    '*currentActivity': '',
    '*currentActivityParams': {},
    '*history': [],
  };

  initCallback() {
    super.initCallback();
    if (this.hasAttribute('current-activity')) {
      this.sub('*currentActivity', (/** @type {String} */ val) => {
        this.setAttribute('current-activity', val);
      });
    }

    if (this.activityType) {
      if (!this.hasAttribute('activity')) {
        this.setAttribute('activity', this.activityType);
      }
      this.sub('*currentActivity', (/** @type {String} */ val) => {
        let activityKey = this.ctxName + this.activityType;
        let actDesc = ActivityBlock._activityRegistry[activityKey];

        if (this.activityType !== val && this[ACTIVE_PROP]) {
          /** @private */
          this[ACTIVE_PROP] = false;
          this.removeAttribute(ACTIVE_ATTR);
          actDesc?.deactivateCallback?.();
          // console.log(`Activity "${this.activityType}" deactivated`);
        } else if (this.activityType === val && !this[ACTIVE_PROP]) {
          /** @private */
          this[ACTIVE_PROP] = true;
          this.setAttribute(ACTIVE_ATTR, '');
          actDesc?.activateCallback?.();
          // console.log(`Activity "${this.activityType}" activated`);

          let history = this.$['*history'];
          if (history.length > 10) {
            history = history.slice(history.length - 11, history.length - 1);
          }
          history.push(this.activityType);
          this.$['*history'] = history;
        }
      });
    }
  }

  /**
   * @private
   * @type {{ String: { activateCallback: Function; deactivateCallback: Function } }}
   */
  static _activityRegistry = Object.create(null);

  get isActivityActive() {
    return this[ACTIVE_PROP];
  }

  /**
   * @param {String} name
   * @param {() => void} [activateCallback]
   * @param {() => void} [deactivateCallback]
   */
  registerActivity(name, activateCallback, deactivateCallback) {
    if (!ActivityBlock._activityRegistry) {
      ActivityBlock._activityRegistry = Object.create(null);
    }
    let actKey = this.ctxName + name;
    ActivityBlock._activityRegistry[actKey] = {
      activateCallback,
      deactivateCallback,
    };
  }

  get activityParams() {
    return this.$['*currentActivityParams'];
  }

  /** @type {String} */
  get initActivity() {
    return this.getCssData('--cfg-init-activity');
  }

  /** @type {String} */
  get doneActivity() {
    return this.getCssData('--cfg-done-activity');
  }

  historyBack() {
    /** @type {String[]} */
    let history = this.$['*history'];
    history.pop();
    let prevActivity = history.pop();
    this.$['*currentActivity'] = prevActivity;
    this.$['*history'] = history;
  }
}

/** @enum {String} */
ActivityBlock.activities = Object.freeze({
  START_FROM: 'start-from',
  CAMERA: 'camera',
  DRAW: 'draw',
  UPLOAD_LIST: 'upload-list',
  URL: 'url',
  CONFIRMATION: 'confirmation',
  CLOUD_IMG_EDIT: 'cloud-image-edit',
  EXTERNAL: 'external',
  DETAILS: 'details',
});
