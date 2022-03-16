import { BaseComponent } from '@symbiotejs/symbiote';
import { l10nProcessor } from './l10nProcessor.js';

export class ElementComponent extends BaseComponent {
  /** @type {String} */
  static __tagPrefix = 'uc-';

  /**
   * @param {String} str
   * @returns {String}
   */
  l10n(str) {
    return this.getCssData('--l10n-' + str, true) || str;
  }

  constructor() {
    super();
    this.addTemplateProcessor(l10nProcessor);
    /**
     * @private
     * @type {String[]}
     */
    this.__l10nKeys = [];
    /** @private */
    this.__l10nUpdate = () => {
      this.dropCssDataCache();
      for (let key of this.__l10nKeys) {
        this.notify(key);
      }
    };
    window.addEventListener('uc-l10n-update', this.__l10nUpdate);
  }

  /**
   * @param {String} localPropKey
   * @param {String} l10nKey
   */
  applyL10nKey(localPropKey, l10nKey) {
    this.$['l10n:' + localPropKey] = l10nKey;
  }

  destroyCallback() {
    window.removeEventListener('uc-l10n-update', this.__l10nUpdate);
    /** @private */
    this.__l10nKeys = null;
  }

  /** @param {String} name? */
  static reg(name) {
    if (!name) {
      super.reg();
      return;
    }
    super.reg(name.startsWith(this.__tagPrefix) ? name : this.__tagPrefix + name);
  }

  /**
   * @private
   * @type {String[]}
   */
  static _ctxConnectionsList = [];
}
