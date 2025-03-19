// @ts-check
import { debounce } from '../blocks/utils/debounce.js';
import { EventType } from '../blocks/UploadCtxProvider/EventEmitter.js';
import { Block } from './Block.js';
import { activityBlockCtx } from './CTX.js';

const ACTIVE_ATTR = 'active';
const ACTIVE_PROP = '___ACTIVITY_IS_ACTIVE___';

/**
 * @typedef {{
 *   'cloud-image-edit': import('../blocks/CloudImageEditorActivity/CloudImageEditorActivity.js').ActivityParams;
 *   external: import('../blocks/ExternalSource/ExternalSource.js').ActivityParams;
 * }} ActivityParamsMap
 */

export class ActivityBlock extends Block {
  /** @protected */
  historyTracked = false;

  init$ = activityBlockCtx(this);

  _debouncedHistoryFlush = debounce(this._historyFlush.bind(this), 10);

  /** @private */
  _deactivate() {
    let actDesc = ActivityBlock._activityCallbacks.get(this);
    this[ACTIVE_PROP] = false;
    this.removeAttribute(ACTIVE_ATTR);
    actDesc?.deactivateCallback?.();
  }

  /** @private */
  _activate() {
    let actDesc = ActivityBlock._activityCallbacks.get(this);
    this.$['*historyBack'] = this.historyBack.bind(this);
    /** @private */
    this[ACTIVE_PROP] = true;
    this.setAttribute(ACTIVE_ATTR, '');
    actDesc?.activateCallback?.();

    this._debouncedHistoryFlush();

    this.emit(EventType.ACTIVITY_CHANGE, {
      activity: this.activityType,
    });
  }

  /** @protected */
  initCallback() {
    super.initCallback();

    // TODO: rename activityType to activityId
    if (this.activityType) {
      if (!this.hasAttribute('activity')) {
        this.setAttribute('activity', this.activityType);
      }
      this.sub('*currentActivity', (/** @type {String} */ val) => {
        try {
          if (this.activityType !== val && this[ACTIVE_PROP]) {
            this._deactivate();
          } else if (this.activityType === val && !this[ACTIVE_PROP]) {
            this._activate();
          }
        } catch (err) {
          console.error(`Error in activity "${this.activityType}". `, err);
          this.$['*currentActivity'] = this.$['*history'][this.$['*history'].length - 1] ?? null;
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
      if (this.historyTracked && history[history.length - 1] !== this.activityType) {
        history.push(this.activityType);
      }
      this.$['*history'] = history;
    }
  }

  /** @private */
  _isActivityRegistered() {
    return this.activityType && ActivityBlock._activityCallbacks.has(this);
  }

  /**
   * @private
   * @type {Map<
   *   ActivityBlock,
   *   { activateCallback: (() => void) | undefined; deactivateCallback: (() => void) | undefined }
   * >}
   */
  static _activityCallbacks = new Map();

  get isActivityActive() {
    return this[ACTIVE_PROP];
  }

  get couldOpenActivity() {
    return true;
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
    ActivityBlock._activityCallbacks.set(this, {
      activateCallback: onActivate,
      deactivateCallback: onDeactivate,
    });
  }

  unregisterActivity() {
    if (this.isActivityActive) {
      this._deactivate();
    }
    ActivityBlock._activityCallbacks.delete(this);
  }

  /** @protected */
  destroyCallback() {
    super.destroyCallback();
    this._isActivityRegistered() && this.unregisterActivity();

    /** @type {string | null} */
    const currentActivity = this.$['*currentActivity'];

    const hasCurrentActivityInCtx = !![...this.blocksRegistry].find(
      (block) => block instanceof ActivityBlock && block.activityType === currentActivity,
    );

    if (!hasCurrentActivityInCtx) {
      this.$['*currentActivity'] = null;
      this.modalManager.closeAll();
    }
  }

  get activityKey() {
    return this.ctxName + this.activityType;
  }

  /** @type {ActivityParamsMap[keyof ActivityParamsMap]} */
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

      let couldOpenActivity = !!nextActivity;
      if (nextActivity) {
        const nextActivityBlock = [...this.blocksRegistry].find((block) => block.activityType === nextActivity);
        couldOpenActivity = /** @type {ActivityBlock} */ (nextActivityBlock)?.couldOpenActivity ?? false;
      }

      nextActivity = couldOpenActivity ? nextActivity : undefined;

      if (nextActivity) this.modalManager.open(nextActivity);

      this.$['*currentActivity'] = nextActivity;
      this.$['*history'] = history;

      if (!nextActivity) {
        this.modalManager.closeAll();
      }
    }
  }
}

ActivityBlock.activities = Object.freeze({
  START_FROM: 'start-from',
  CAMERA: 'camera',
  DRAW: 'draw',
  UPLOAD_LIST: 'upload-list',
  URL: 'url',
  CLOUD_IMG_EDIT: 'cloud-image-edit',
  EXTERNAL: 'external',
});

/** @typedef {(typeof ActivityBlock)['activities'][keyof (typeof ActivityBlock)['activities']]} RegisteredActivityType */
/** @typedef {RegisteredActivityType | (string & {}) | null} ActivityType */
