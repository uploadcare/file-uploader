//  @ts-check

const DEFAULT_DEBOUNCE_TIMEOUT = 20;

export const EventType = Object.freeze({
  UPLOAD_START: 'upload-start',
  REMOVE: 'remove',
  UPLOAD_PROGRESS: 'upload-progress',
  UPLOAD_FINISH: 'upload-finish',
  UPLOAD_ERROR: 'upload-error',
  VALIDATION_ERROR: 'validation-error',
  CLOUD_MODIFICATION: 'cloud-modification',
  DATA_OUTPUT: 'data-output',
  DONE_FLOW: 'done-flow',
  INIT_FLOW: 'init-flow',
});

/** Those are legacy events that are saved for backward compatibility. Should be removed before v1. */
export const GlobalEventType = Object.freeze({
  [EventType.UPLOAD_START]: 'LR_UPLOAD_START',
  [EventType.REMOVE]: 'LR_REMOVE',
  [EventType.UPLOAD_PROGRESS]: 'LR_UPLOAD_PROGRESS',
  [EventType.UPLOAD_FINISH]: 'LR_UPLOAD_FINISH',
  [EventType.UPLOAD_ERROR]: 'LR_UPLOAD_ERROR',
  [EventType.VALIDATION_ERROR]: 'LR_VALIDATION_ERROR',
  [EventType.CLOUD_MODIFICATION]: 'LR_CLOUD_MODIFICATION',
  [EventType.DATA_OUTPUT]: 'LR_DATA_OUTPUT',
  [EventType.DONE_FLOW]: 'LR_DONE_FLOW',
  [EventType.INIT_FLOW]: 'LR_INIT_FLOW',
});

/**
 * @typedef {{
 *   [EventType.UPLOAD_START]: import('../../index.js').OutputFileEntry[];
 *   [EventType.REMOVE]: import('../../index.js').OutputFileEntry[];
 *   [EventType.UPLOAD_PROGRESS]: number;
 *   [EventType.UPLOAD_FINISH]: import('../../index.js').OutputFileEntry[];
 *   [EventType.UPLOAD_ERROR]: Error | null;
 *   [EventType.VALIDATION_ERROR]: string | null;
 *   [EventType.CLOUD_MODIFICATION]: string | null;
 *   [EventType.DATA_OUTPUT]: import('../../index.js').OutputFileEntry[];
 *   [EventType.DONE_FLOW]: never;
 *   [EventType.INIT_FLOW]: never;
 * }} EventPayload
 */

/**
 * @typedef {{
 *   [T in (typeof EventType)[keyof typeof EventType] as (typeof GlobalEventType)[T]]: {
 *     type: (typeof GlobalEventType)[T];
 *     ctx: string;
 *     data: EventPayload[T];
 *   };
 * }} GlobalEventPayload
 */

export class EventEmitter {
  /**
   * @private
   * @type {Map<string, number>}
   */
  _timeoutStore = new Map();

  /** @param {() => string} getCtxName */
  constructor(getCtxName) {
    /** @private */
    this._getCtxName = getCtxName;
    /**
     * @private
     * @type {import('../../abstract/Block.js').Block}
     */
  }

  /** @param {import('../../abstract/Block.js').Block} target */
  bindTarget(target) {
    /** @private */
    this._target = target;
  }

  /**
   * @private
   * @template {(typeof EventType)[keyof typeof EventType]} T
   * @param {T} type
   * @param {EventPayload[T]} [payload]
   */
  _dispatch(type, payload) {
    this._target?.dispatchEvent(
      new CustomEvent(type, {
        detail: payload,
      })
    );

    const globalEventType = GlobalEventType[type];
    window.dispatchEvent(
      new CustomEvent(globalEventType, {
        detail: {
          ctx: this._getCtxName(),
          type: globalEventType,
          data: payload,
        },
      })
    );
  }

  /**
   * @template {(typeof EventType)[keyof typeof EventType]} T
   * @param {T} type
   * @param {EventPayload[T]} [payload]
   * @param {{ debounce?: boolean | number }} [options]
   */
  emit(type, payload, { debounce } = {}) {
    if (typeof debounce !== 'number' && !debounce) {
      this._dispatch(type, payload);
      return;
    }

    // TODO: remove debounce after events refactor
    if (this._timeoutStore.has(type)) {
      window.clearTimeout(this._timeoutStore.get(type));
    }
    const timeout = typeof debounce === 'number' ? debounce : DEFAULT_DEBOUNCE_TIMEOUT;
    const timeoutId = window.setTimeout(() => {
      this._dispatch(type, payload);
      this._timeoutStore.delete(type);
    }, timeout);
    this._timeoutStore.set(type, timeoutId);
  }
}
