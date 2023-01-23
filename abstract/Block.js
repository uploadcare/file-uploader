import { BaseComponent, Data } from '@symbiotejs/symbiote';
import { applyTemplateData, getPluralObjects } from '../utils/template-utils.js';
import { l10nProcessor } from './l10nProcessor.js';
import { blockCtx } from './CTX.js';
import { createWindowHeightTracker, getIsWindowHeightTracked } from '../utils/createWindowHeightTracker.js';

const TAG_PREFIX = 'lr-';

export class Block extends BaseComponent {
  static StateConsumerScope = null;
  allowCustomTemplate = true;

  ctxInit = blockCtx();
  init$ = this.ctxInit;

  /**
   * @param {String} str
   * @param {{ [key: string]: string | number }} variables
   * @returns {String}
   */
  l10n(str, variables = {}) {
    if (!str) {
      return '';
    }
    let template = this.getCssData('--l10n-' + str, true) || str;
    let pluralObjects = getPluralObjects(template);
    for (let pluralObject of pluralObjects) {
      variables[pluralObject.variable] = this.pluralize(
        pluralObject.pluralKey,
        Number(variables[pluralObject.countVariable])
      );
    }
    let result = applyTemplateData(template, variables);
    return result;
  }

  /**
   * @param {string} key
   * @param {number} count
   * @returns {string}
   */
  pluralize(key, count) {
    const locale = this.l10n('locale-name') || 'en-US';
    const pluralForm = new Intl.PluralRules(locale).select(count);
    return this.l10n(`${key}__${pluralForm}`);
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
   * @param {(block: Block) => boolean} callback
   * @returns {Boolean}
   */
  findBlockInCtx(callback) {
    /** @type {Set} */
    let blocksRegistry = this.$['*blocksRegistry'];
    for (let block of blocksRegistry) {
      if (callback(block)) {
        return true;
      }
    }
    return false;
  }

  /**
   * @param {String} consumerScope
   * @param {String} prop
   * @param {any} newVal
   */
  setForCtxTarget(consumerScope, prop, newVal) {
    if (this.findBlockInCtx((b) => /** @type {typeof Block} */ (b.constructor).StateConsumerScope === consumerScope)) {
      this.$[prop] = newVal;
    }
  }
  /**
   * @param {String} consumerScope
   * @param {String} prop
   */
  getForCtxTarget(consumerScope, prop) {
    if (this.findBlockInCtx((b) => /** @type {typeof Block} */ (b.constructor).StateConsumerScope === consumerScope)) {
      return this.$[prop];
    }
  }

  /** @param {String} activityType */
  setActivity(activityType) {
    if (this.findBlockInCtx((b) => b.activityType === activityType)) {
      this.$['*currentActivity'] = activityType;
      return;
    }
    console.warn(`Activity type "${activityType}" not found in the context`);
  }

  connectedCallback() {
    if (!getIsWindowHeightTracked()) {
      this._destroyInnerHeightTracker = createWindowHeightTracker();
    }
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

  disconnectedCallback() {
    super.disconnectedCallback();
    this._destroyInnerHeightTracker?.();
  }

  initCallback() {
    let blocksRegistry = this.$['*blocksRegistry'];
    blocksRegistry.add(this);
  }

  destroyCallback() {
    let blocksRegistry = this.$['*blocksRegistry'];
    blocksRegistry.delete(this);
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
