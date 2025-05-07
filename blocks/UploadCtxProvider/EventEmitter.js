//  @ts-check

const DEFAULT_DEBOUNCE_TIMEOUT = 20;

export const EventType = Object.freeze({
  FILE_ADDED: 'file-added',
  FILE_REMOVED: 'file-removed',
  FILE_UPLOAD_START: 'file-upload-start',
  FILE_UPLOAD_PROGRESS: 'file-upload-progress',
  FILE_UPLOAD_SUCCESS: 'file-upload-success',
  FILE_UPLOAD_FAILED: 'file-upload-failed',
  FILE_URL_CHANGED: 'file-url-changed',

  MODAL_OPEN: 'modal-open',
  MODAL_CLOSE: 'modal-close',
  DONE_CLICK: 'done-click',
  UPLOAD_CLICK: 'upload-click',
  ACTIVITY_CHANGE: 'activity-change',

  COMMON_UPLOAD_START: 'common-upload-start',
  COMMON_UPLOAD_PROGRESS: 'common-upload-progress',
  COMMON_UPLOAD_SUCCESS: 'common-upload-success',
  COMMON_UPLOAD_FAILED: 'common-upload-failed',

  CHANGE: 'change',
  GROUP_CREATED: 'group-created',
});

/**
 * @typedef {{
 *   [EventType.FILE_ADDED]: import('../../index.js').OutputFileEntry<'idle'>;
 *   [EventType.FILE_REMOVED]: import('../../index.js').OutputFileEntry<'removed'>;
 *   [EventType.FILE_UPLOAD_START]: import('../../index.js').OutputFileEntry<'uploading'>;
 *   [EventType.FILE_UPLOAD_PROGRESS]: import('../../index.js').OutputFileEntry<'uploading'>;
 *   [EventType.FILE_UPLOAD_SUCCESS]: import('../../index.js').OutputFileEntry<'success'>;
 *   [EventType.FILE_UPLOAD_FAILED]: import('../../index.js').OutputFileEntry<'failed'>;
 *   [EventType.FILE_URL_CHANGED]: import('../../index.js').OutputFileEntry<'success'>;
 *   [EventType.MODAL_OPEN]: { modalId: import('../../abstract/ModalManager.js').ModalId };
 *   [EventType.MODAL_CLOSE]: { modalId: import('../../abstract/ModalManager.js').ModalId; hasActiveModals: boolean };
 *   [EventType.ACTIVITY_CHANGE]: {
 *     activity: import('../../abstract/ActivityBlock.js').ActivityType;
 *   };
 *   [EventType.UPLOAD_CLICK]: void;
 *   [EventType.DONE_CLICK]: import('../../index.js').OutputCollectionState;
 *   [EventType.COMMON_UPLOAD_START]: import('../../index.js').OutputCollectionState<'uploading'>;
 *   [EventType.COMMON_UPLOAD_PROGRESS]: import('../../index.js').OutputCollectionState<'uploading'>;
 *   [EventType.COMMON_UPLOAD_SUCCESS]: import('../../index.js').OutputCollectionState<'success'>;
 *   [EventType.COMMON_UPLOAD_FAILED]: import('../../index.js').OutputCollectionState<'failed'>;
 *   [EventType.CHANGE]: import('../../index.js').OutputCollectionState;
 *   [EventType.GROUP_CREATED]: import('../../index.js').OutputCollectionState<'success', 'has-group'>;
 * }} EventPayload
 */

export class EventEmitter {
  /**
   * @private
   * @type {Map<string, number>}
   */
  _timeoutStore = new Map();

  /**
   * @private
   * @type {Set<import('../../abstract/Block.js').Block>}
   */
  _targets = new Set();

  /**
   * @private
   * @type {((...args: unknown[]) => void) | null}
   */
  _debugPrint = null;

  /** @param {(...args: unknown[]) => void} debugPrint */
  constructor(debugPrint) {
    this._debugPrint = debugPrint;
  }

  /** @param {import('../../abstract/Block.js').Block} target */
  bindTarget(target) {
    this._targets.add(target);
  }

  /** @param {import('../../abstract/Block.js').Block} target */
  unbindTarget(target) {
    this._targets.delete(target);
  }

  /**
   * @private
   * @template {(typeof EventType)[keyof typeof EventType]} T
   * @param {T} type
   * @param {unknown} [payload]
   */
  _dispatch(type, payload) {
    for (const target of this._targets) {
      target.dispatchEvent(
        new CustomEvent(type, {
          detail: payload,
        }),
      );
    }

    this._debugPrint?.(() => {
      const copyPayload = !!payload && typeof payload === 'object' ? { ...payload } : payload;
      return [`event "${type}"`, copyPayload];
    });
  }

  /**
   * @template {(typeof EventType)[keyof typeof EventType]} T
   * @template {boolean | number | undefined} TDebounce
   * @param {T} type
   * @param {TDebounce extends false | undefined ? unknown : () => unknown} [payload]
   * @param {{ debounce?: TDebounce }} [options]
   */
  emit(type, payload, { debounce } = {}) {
    if (typeof debounce !== 'number' && !debounce) {
      this._dispatch(type, typeof payload === 'function' ? payload() : payload);
      return;
    }

    if (this._timeoutStore.has(type)) {
      window.clearTimeout(this._timeoutStore.get(type));
    }
    const timeout = typeof debounce === 'number' ? debounce : DEFAULT_DEBOUNCE_TIMEOUT;
    const timeoutId = window.setTimeout(() => {
      this._dispatch(type, typeof payload === 'function' ? payload() : payload);
      this._timeoutStore.delete(type);
    }, timeout);
    this._timeoutStore.set(type, timeoutId);
  }
}
