/** @enum {String} */
export const EVENT_TYPES = {
  UPLOAD_START: 'UPLOAD_START',
  REMOVE: 'REMOVE',
  UPLOAD_PROGRESS: 'UPLOAD_PROGRESS',
  UPLOAD_FINISH: 'UPLOAD_FINISH',
  UPLOAD_ERROR: 'UPLOAD_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  CDN_MODIFICATION: 'CLOUD_MODIFICATION',
  DATA_OUTPUT: 'DATA_OUTPUT',
};

export class EventData {
  /**
   * @param {Object} src
   * @param {EVENT_TYPES} src.type
   * @param {String} src.ctx
   * @param {any} src.data
   */
  constructor(src) {
    /** @type {String} */
    this.ctx = src.ctx;
    /** @type {EVENT_TYPES} */
    this.type = src.type;
    this.data = src.data;
  }
}

export class EventManager {
  /** @param {EVENT_TYPES} type */
  static eName(type) {
    return 'LR_' + type;
  }

  /** @private */
  static _timeoutStore = Object.create(null);

  /**
   * @param {EventData} eData
   * @param {import('./UploaderBlock.js').UploaderBlock | Window} [el]
   * @param {Boolean} [debounce]
   */
  static emit(eData, el = window, debounce = true) {
    let dispatch = () => {
      el.dispatchEvent(
        new CustomEvent(this.eName(eData.type), {
          detail: eData,
        })
      );
    };
    if (!debounce) {
      dispatch();
      return;
    }
    let timeoutKey = eData.type + eData.ctx;
    if (this._timeoutStore[timeoutKey]) {
      window.clearTimeout(this._timeoutStore[timeoutKey]);
    }
    this._timeoutStore[timeoutKey] = window.setTimeout(() => {
      dispatch();
      delete this._timeoutStore[timeoutKey];
    }, 20);
  }
}
