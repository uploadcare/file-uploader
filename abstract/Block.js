// @ts-check
import { BaseComponent, Data } from '@symbiotejs/symbiote';
import { EventEmitter } from '../blocks/UploadCtxProvider/EventEmitter.js';
import { WindowHeightTracker } from '../utils/WindowHeightTracker.js';
import { getPluralForm } from '../utils/getPluralForm.js';
import { applyTemplateData, getPluralObjects } from '../utils/template-utils.js';
import { toKebabCase } from '../utils/toKebabCase.js';
import { waitForAttribute } from '../utils/waitForAttribute.js';
import { warnOnce } from '../utils/warnOnce.js';
import { blockCtx } from './CTX.js';
import { l10nProcessor } from './l10nProcessor.js';
import { sharedConfigKey } from './sharedConfigKey.js';

const TAG_PREFIX = 'lr-';

// @ts-ignore TODO: fix this
export class Block extends BaseComponent {
  /** @type {string | null} */
  static StateConsumerScope = null;
  static className = '';
  requireCtxName = false;
  allowCustomTemplate = true;
  /** @type {import('./ActivityBlock.js').ActivityType} */
  activityType = null;

  init$ = blockCtx();

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
        Number(variables[pluralObject.countVariable]),
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
    const pluralForm = getPluralForm(locale, count);
    return this.l10n(`${key}__${pluralForm}`);
  }

  constructor() {
    super();
    // @ts-ignore TODO: fix this
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
   * @param {Parameters<import('../blocks/UploadCtxProvider/EventEmitter.js').EventEmitter['emit']>[0]} type
   * @param {Parameters<import('../blocks/UploadCtxProvider/EventEmitter.js').EventEmitter['emit']>[1]} [payload]
   * @param {Parameters<import('../blocks/UploadCtxProvider/EventEmitter.js').EventEmitter['emit']>[2]} [options]
   */
  emit(type, payload, options) {
    /** @type {import('../blocks/UploadCtxProvider/EventEmitter.js').EventEmitter} */
    const eventEmitter = this.has('*eventEmitter') && this.$['*eventEmitter'];
    if (!eventEmitter) {
      return;
    }
    eventEmitter.emit(type, payload, options);
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
  hasBlockInCtx(callback) {
    // @ts-ignore TODO: fix this
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
   * @param {String} prop
   * @param {any} newVal
   */
  setOrAddState(prop, newVal) {
    this.add$(
      {
        [prop]: newVal,
      },
      true,
    );
  }

  /** @param {import('./ActivityBlock.js').ActivityType} activityType */
  setActivity(activityType) {
    if (this.hasBlockInCtx((b) => b.activityType === activityType)) {
      this.$['*currentActivity'] = activityType;
      return;
    }
    console.warn(`Activity type "${activityType}" not found in the context`);
  }

  connectedCallback() {
    const className = /** @type {typeof Block} */ (this.constructor).className;
    if (className) {
      this.classList.toggle(`${TAG_PREFIX}${className}`, true);
    }

    if (this.hasAttribute('retpl')) {
      // @ts-ignore TODO: fix this
      this.constructor['template'] = null;
      this.processInnerHtml = true;
    }
    if (this.requireCtxName) {
      waitForAttribute({
        element: this,
        attribute: 'ctx-name',
        onSuccess: () => {
          // async wait for ctx-name attribute to be set, needed for Angular because it sets attributes after mount
          // TODO: should be moved to the symbiote core
          super.connectedCallback();
        },
        onTimeout: () => {
          console.error('Attribute `ctx-name` is required and it is not set.');
        },
      });
    } else {
      super.connectedCallback();
    }

    WindowHeightTracker.registerClient(this);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    WindowHeightTracker.unregisterClient(this);
  }

  initCallback() {
    let blocksRegistry = this.$['*blocksRegistry'];
    blocksRegistry.add(this);

    if (!this.$['*eventEmitter']) {
      this.$['*eventEmitter'] = new EventEmitter(this.debugPrint.bind(this));
    }
  }

  destroyCallback() {
    /** @type {Set<Block>} */
    let blocksRegistry = this.$['*blocksRegistry'];
    blocksRegistry.delete(this);

    // Destroy local context
    // TODO: this should be done inside symbiote
    Data.deleteCtx(this);

    if (blocksRegistry.size === 0) {
      setTimeout(() => {
        // Destroy global context after all blocks are destroyed and all callbacks are run
        this.destroyCtxCallback();
      }, 0);
    }
  }

  /**
   * Called when the last block is removed from the context. Note that inheritors must run their callback before that.
   *
   * @protected
   */
  destroyCtxCallback() {
    Data.deleteCtx(this.ctxName);
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
    let previewProxy = this.cfg.secureDeliveryProxy;
    if (!previewProxy) {
      return url;
    }
    return applyTemplateData(
      previewProxy,
      { previewUrl: url },
      { transform: (value) => window.encodeURIComponent(value) },
    );
  }

  /**
   * @param {String} prop
   * @protected
   */
  parseCfgProp(prop) {
    return {
      ctx: this.nodeCtx,
      name: prop.replace('*', ''),
    };
  }

  /** @returns {import('../types').ConfigType} } */
  get cfg() {
    if (!this.__cfgProxy) {
      let o = Object.create(null);
      /** @private */
      this.__cfgProxy = new Proxy(o, {
        set: (obj, key, value) => {
          if (typeof key !== 'string') {
            return false;
          }
          const sharedKey = sharedConfigKey(/** @type {keyof import('../types').ConfigType} */ (key));
          this.$[sharedKey] = value;
          return true;
        },
        /**
         * @param {never} obj
         * @param {keyof import('../types').ConfigType} key
         */
        get: (obj, key) => {
          const sharedKey = sharedConfigKey(key);
          const parsed = this.parseCfgProp(sharedKey);
          if (parsed.ctx.has(parsed.name)) {
            return parsed.ctx.read(parsed.name);
          } else {
            warnOnce(
              'Using CSS variables for configuration is deprecated. Please use `lr-config` instead. See migration guide: https://uploadcare.com/docs/file-uploader/migration-to-0.25.0/',
            );
            return this.getCssData(`--cfg-${toKebabCase(key)}`);
          }
        },
      });
    }
    return this.__cfgProxy;
  }

  /**
   * @template {keyof import('../types').ConfigType} T
   * @param {T} key
   * @param {(value: import('../types').ConfigType[T]) => void} callback
   */
  subConfigValue(key, callback) {
    const parsed = this.parseCfgProp(sharedConfigKey(key));
    if (parsed.ctx.has(parsed.name)) {
      this.sub(sharedConfigKey(key), callback);
    } else {
      this.bindCssData(`--cfg-${toKebabCase(key)}`);
      this.sub(`--cfg-${toKebabCase(key)}`, callback);
    }
  }

  /** @deprecated */
  updateCtxCssData = () => {
    warnOnce(
      'Using CSS variables for configuration is deprecated. Please use `lr-config` instead. See migration guide: https://uploadcare.com/docs/file-uploader/migration-to-0.25.0/',
    );

    /** @type {Set<Block>} */
    let blocks = this.$['*blocksRegistry'];
    for (let block of blocks) {
      if (block.isConnected) {
        block.updateCssData();
      }
    }
  };

  /** @param {unknown[]} args */
  debugPrint(...args) {
    if (!this.cfg.debug) {
      return;
    }
    let consoleArgs = args;
    if (typeof args?.[0] === 'function') {
      const resolver = args[0];
      consoleArgs = resolver();
    }
    console.log(`[${this.debugCtxName}]`, ...consoleArgs);
  }

  get debugCtxName() {
    return this.ctxName;
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
