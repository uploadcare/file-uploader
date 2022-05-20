import { Block } from '../../abstract/Block.js';

/**
 * @typedef {{
 *   previewUrlCallback: import('../../abstract/Block.js').PreviewUrlCallback;
 * }} State
 */

/** @extends {Block<{}>} */
export class Configuration extends Block {
  /** @type {State} */
  _initialState = {
    previewUrlCallback: null,
  };

  /** @type {Boolean} */
  _initialized = false;

  init$ = this._initialState;

  initCallback() {
    this._initialized = true;

    for (let [key, value] of Object.entries(this._initialState)) {
      this.$['*' + key] = value;
    }
  }

  /**
   * @param {String} key
   * @param {unknown} value
   */
  _setProperty(key, value) {
    if (this._initialized) {
      this.$['*' + key] = value;
    } else {
      this._initialState[key] = value;
    }
  }

  /**
   * @param {import('../../abstract/Block.js').PreviewUrlCallback} callback
   * @public
   */
  setPreviewUrlCallback(callback) {
    this._setProperty('previewUrlCallback', callback);
  }
}
