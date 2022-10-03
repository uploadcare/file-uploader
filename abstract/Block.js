import { BaseComponent, Data } from '@symbiotejs/symbiote';
import { applyTemplateData } from '../utils/applyTemplateData.js';
import { l10nProcessor } from './l10nProcessor.js';
import { blockCtx } from './CTX.js';

const TAG_PREFIX = 'lr-';

export class Block extends BaseComponent {
  allowCustomTemplate = true;

  ctxInit = blockCtx();
  init$ = this.ctxInit;

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
    // TODO: inspect template on lr-* elements
    // this.addTemplateProcessor((fr) => {
    //   [...fr.querySelectorAll('*')].forEach((el) => {
    //     if (el.tagName.includes('LR-')) {
    //       let tag = el.tagName.toLowerCase();
    //       console.log(window.customElements.get(tag)?.name);
    //     }
    //   });
    // });
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
    return registry?.has(targetTagName);
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
    if (this.isConnected && this['__ctxOwner']) {
      let data = Data.getCtx(this.ctxName, false);
      if (data) {
        data.store = { ...this.ctxInit };
      }
    }
    super.connectedCallback();
  }

  initCallback() {
    let tagName = this.constructor['is'];
    let registry = this.$['*ctxTargetsRegistry'];
    let counter = registry.has(tagName) ? registry.get(tagName) + 1 : 1;
    registry.set(tagName, counter);
    this.$['*ctxTargetsRegistry'] = registry;
  }

  destroyCallback() {
    let tagName = this.constructor['is'];
    let registry = this.$['*ctxTargetsRegistry'];
    let newCount = registry.has(registry) ? registry.get(tagName) - 1 : 0;
    if (newCount === 0) {
      registry.delete(tagName);
    } else {
      registry.set(tagName, newCount);
    }
    this.$['*ctxTargetsRegistry'] = registry;
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

  /** @param {String} [name] */
  static reg(name) {
    if (!name) {
      super.reg();
      return;
    }
    super.reg(name.startsWith(TAG_PREFIX) ? name : TAG_PREFIX + name);
  }
}

export { BaseComponent };
