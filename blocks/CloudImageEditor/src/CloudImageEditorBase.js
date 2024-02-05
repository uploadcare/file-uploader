// @ts-check
import { Data } from '@symbiotejs/symbiote';
import { Block } from '../../../abstract/Block.js';

const CSS_CFG_CTX_NAME = '--cfg-ctx-name';

export class CloudImageEditorBase extends Block {
  /**
   * @private
   * @returns {string}
   */
  get cfgCssCtxName() {
    return this.getCssData(CSS_CFG_CTX_NAME, true);
  }

  /** @private */
  get cfgCtxName() {
    const ctxName = this.getAttribute('ctx-name')?.trim() || this.cfgCssCtxName || this.__cachedCfgCtxName;
    if (!ctxName) {
      throw new Error(`ctx-name attribute is required for ${this.constructor.name}`);
    }
    /**
     * Cache last ctx name to be able to access context when element becames disconnected
     *
     * @type {String}
     */
    this.__cachedCfgCtxName = ctxName;
    return ctxName;
  }

  connectedCallback() {
    if (!this.connectedOnce) {
      const ctxName = this.getAttribute('ctx-name')?.trim();
      if (ctxName) {
        this.style.setProperty(CSS_CFG_CTX_NAME, `'${ctxName}'`);
      }
    }

    super.connectedCallback();
  }

  /**
   * Resolve cfg from context passed with ctx-name attribute
   *
   * @param {String} prop
   * @returns {any}
   * @protected
   */
  parseCfgProp(prop) {
    const parsed = {
      ...super.parseCfgProp(prop),
      ctx: Data.getCtx(this.cfgCtxName),
    };
    return parsed;
  }

  get debugCtxName() {
    return this.cfgCtxName;
  }
}
