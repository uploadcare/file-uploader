import { Modal } from '../blocks/Modal/Modal.js';
import { debounce } from '../blocks/utils/debounce.js';
import { Block } from './Block.js';
import { activityBlockCtx } from './CTX.js';

const ACTIVE_ATTR = 'active';
const ACTIVE_PROP = '___ACTIVITY_IS_ACTIVE___';

export class ActivityBlock extends Block {
  ctxInit = activityBlockCtx();

  _debouncedHistoryFlush = debounce(this._historyFlush.bind(this), 10);

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
          this.setForCtxTarget(Modal.StateConsumerScope, '*modalCloseCallback', actDesc?.modalCloseCallback);
          actDesc?.activateCallback?.();
          // console.log(`Activity "${this.activityType}" activated`);

          this._debouncedHistoryFlush();
        }

        if (!val) {
          this.$['*history'] = [];
        }
      });
    }
  }

  _historyFlush() {
    let history = this.$['*history'];
    if (history) {
      if (history.length > 10) {
        history = history.slice(history.length - 11, history.length - 1);
      }
      history.push(this.activityType);
      this.$['*history'] = history;
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
   * @param {Object} [options]
   * @param {() => void} [options.onActivate]
   * @param {() => void} [options.onDeactivate]
   * @param {() => void} [options.onClose]
   */
  registerActivity(name, options) {
    const { onActivate, onDeactivate, onClose } = options;
    if (!ActivityBlock._activityRegistry) {
      ActivityBlock._activityRegistry = Object.create(null);
    }
    let actKey = this.ctxName + name;
    ActivityBlock._activityRegistry[actKey] = {
      activateCallback: onActivate,
      deactivateCallback: onDeactivate,
      modalCloseCallback: onClose,
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
    if (history) {
      history.pop();
      let prevActivity = history.pop();
      this.$['*currentActivity'] = prevActivity;
      this.$['*history'] = history;
      if (!prevActivity) {
        this.setForCtxTarget(Modal.StateConsumerScope, '*modalActive', false);
      }
    }
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
