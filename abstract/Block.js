import { BaseComponent } from '@symbiotejs/symbiote';
import { applyTemplateData } from '../utils/applyTemplateData.js';
import { l10nProcessor } from './l10nProcessor.js';

const TAG_PREFIX = 'lr-';

export class Block extends BaseComponent {
  init$ = {
    '*ctxTargetsRegistry': new Set(),
  };

  /**
   * @param {String} str
   * @param {{ [key: string]: string | number }} variables
   * @returns {String}
   */
  l10n(str, variables = {}) {
    let template = this.getCssData('--l10n-' + str, true) || str;
    let result = applyTemplateData(template, variables);
    return result;
  }

  constructor() {
    super();
    /** @type {String} */
    this.activityType = null;
    this.addTemplateProcessor(l10nProcessor);
    /**
     * @private
     * @type {String[]}
     */
    this.__l10nKeys = [];
  }

  /**
   * @param {String} localPropKey
   * @param {String} l10nKey
   */
  applyL10nKey(localPropKey, l10nKey) {
    let prop = 'l10n:' + localPropKey;
    this.$[prop] = /** @type {any} */ (l10nKey);
    this.__l10nKeys.push(localPropKey);
  }

  /**
   * @param {String} targetTagName
   * @returns {Boolean}
   */
  checkCtxTarget(targetTagName) {
    /** @type {Set} */
    let registry = this.$['*ctxTargetsRegistry'];
    return registry.has(targetTagName);
  }

  /**
   * @param {String} targetTagName
   * @param {String} prop
   * @param {any} newVal
   */
  setForCtxTarget(targetTagName, prop, newVal) {
    if (this.checkCtxTarget(targetTagName)) {
      this.$[prop] = newVal;
    }
  }

  connectedCallback() {
    if (this.hasAttribute('retpl')) {
      this.constructor['template'] = null;
      this.processInnerHtml = true;
    }
    super.connectedCallback();
  }

  initCallback() {
    this.$['*ctxTargetsRegistry']?.add(this.constructor['is']);
  }

  /**
   * @param {Number} bytes
   * @param {Number} [decimals]
   */
  fileSizeFmt(bytes, decimals = 2) {
    let units = ['B', 'KB', 'MB', 'GB', 'TB'];
    /**
     * @param {String} str
     * @returns {String}
     */
    let getUnit = (str) => {
      return this.getCssData('--l10n-unit-' + str.toLowerCase(), true) || str;
    };
    if (bytes === 0) {
      return `0 ${getUnit(units[0])}`;
    }
    let k = 1024;
    let dm = decimals < 0 ? 0 : decimals;
    let i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / k ** i).toFixed(dm)) + ' ' + getUnit(units[i]);
  }

  /**
   * @param {String} url
   * @returns {String}
   */
  proxyUrl(url) {
    let previewProxy = this.getCssData('--cfg-secure-delivery-proxy', true);
    if (!previewProxy) {
      return url;
    }
    return applyTemplateData(
      previewProxy,
      { previewUrl: url },
      { transform: (value) => window.encodeURIComponent(value) }
    );
  }

  /** @param {String} name? */
  static reg(name) {
    if (!name) {
      super.reg();
      return;
    }
    super.reg(name.startsWith(TAG_PREFIX) ? name : TAG_PREFIX + name);
  }
}

export { BaseComponent };
