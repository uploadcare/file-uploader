import { Modal } from '../blocks/Modal/Modal.js';
import { debounce } from '../blocks/utils/debounce.js';
import { Block } from './Block.js';
import { activityBlockCtx } from './CTX.js';

const ACTIVE_ATTR = 'active';
const ACTIVE_PROP = '___ACTIVITY_IS_ACTIVE___';

export class ActivityBlock extends Block {
  historyTracked = false;
  init$ = activityBlockCtx(this);

  _debouncedHistoryFlush = debounce(this._historyFlush.bind(this), 10);

  /** @private */
  _deactivate() {
    let actDesc = ActivityBlock._activityRegistry[this.activityKey];
    this[ACTIVE_PROP] = false;
    this.removeAttribute(ACTIVE_ATTR);
    actDesc?.deactivateCallback?.();
    // console.log(`Activity "${this.activityType}" deactivated`);
  }

  /** @private */
  _activate() {
    let actDesc = ActivityBlock._activityRegistry[this.activityKey];
    this.$['*historyBack'] = this.historyBack.bind(this);
    /** @private */
    this[ACTIVE_PROP] = true;
    this.setAttribute(ACTIVE_ATTR, '');
    actDesc?.activateCallback?.();
    // console.log(`Activity "${this.activityType}" activated`);

    this._debouncedHistoryFlush();
  }

  initCallback() {
    super.initCallback();
    if (this.hasAttribute('current-activity')) {
      this.sub('*currentActivity', (/** @type {String} */ val) => {
        this.setAttribute('current-activity', val);
      });
    }

    // TODO: rename activityType to activityId
    if (this.activityType) {
      if (!this.hasAttribute('activity')) {
        this.setAttribute('activity', this.activityType);
      }
      this.sub('*currentActivity', (/** @type {String} */ val) => {
        if (this.activityType !== val && this[ACTIVE_PROP]) {
          this._deactivate();
        } else if (this.activityType === val && !this[ACTIVE_PROP]) {
          this._activate();
        }

        if (!val) {
          this.$['*history'] = [];
        }
      });
    }
  }

  /** @private */
  _historyFlush() {
    let history = this.$['*history'];
    if (history) {
      if (history.length > 10) {
        history = history.slice(history.length - 11, history.length - 1);
      }
      if (this.historyTracked) {
        history.push(this.activityType);
      }
      this.$['*history'] = history;
    }
  }

  /** @private */
  _isActivityRegistered() {
    return this.activityType && !!ActivityBlock._activityRegistry[this.activityKey];
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
   * TODO: remove name argument
   *
   * @param {String} name
   * @param {Object} [options]
   * @param {() => void} [options.onActivate]
   * @param {() => void} [options.onDeactivate]
   */
  registerActivity(name, options = {}) {
    const { onActivate, onDeactivate } = options;
    if (!ActivityBlock._activityRegistry) {
      ActivityBlock._activityRegistry = Object.create(null);
    }
    ActivityBlock._activityRegistry[this.activityKey] = {
      activateCallback: onActivate,
      deactivateCallback: onDeactivate,
    };
  }

  unregisterActivity() {
    if (this.isActivityActive) {
      this._deactivate();
    }
    ActivityBlock._activityRegistry[this.activityKey] = undefined;
  }

  destroyCallback() {
    super.destroyCallback();
    this._isActivityRegistered() && this.unregisterActivity();

    if (Object.keys(ActivityBlock._activityRegistry).length === 0) {
      // TODO: we should track activities more precise and reset current activity only if there is no such registered activity
      this.$['*currentActivity'] = null;
    }
  }

  get activityKey() {
    return this.ctxName + this.activityType;
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
      let nextActivity = history.pop();
      while (nextActivity === this.activityType) {
        nextActivity = history.pop();
      }
      this.$['*currentActivity'] = nextActivity;
      this.$['*history'] = history;
      if (!nextActivity) {
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
