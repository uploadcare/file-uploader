import { CFG_DEFAULTS } from './CFG_DEFAULTS.js';
import { State } from '../../../symbiote/core/State.js';

export class CfgMngr {
  static getFormScriptTag() {
    let scriptEl,
      src,
      optionsStr,
      cfg = { ...CFG_DEFAULTS };
    scriptEl = document.querySelector('script[src*="/uploadcare.js"]');
    if (scriptEl) {
      src = scriptEl.getAttribute('src');
    }
    if (src) {
      // eslint-disable-next-line prefer-destructuring
      optionsStr = src.split('?')[1];
      if (optionsStr) {
        optionsStr.split('&').forEach((pare) => {
          let pareArr = pare.split('=');
          cfg[pareArr[0]] = pareArr[1] || true;
        });
      }
    }
    return cfg;
  }

  static getFromAttributes(el) {
    let parsers = {
      Array: (val) => val.split(',').map((p) => p.trim()),
      Number: (val) => parseFloat(val),
      Boolean: (val) => val.trim().toLowerCase() === 'true',
      String: (val) => val.trim().toLowerCase(),
      Object: (val) => JSON.parse(val),
    };
    return Object.keys(CFG_DEFAULTS).reduce((cfg, prop) => {
      if (el.hasAttribute(prop)) {
        let value = el.getAttribute(prop);
        cfg[prop] = parsers[CFG_DEFAULTS[prop].constructor.name]?.(value);
      } else {
        cfg[prop] = CFG_DEFAULTS[prop];
      }
      return cfg;
    }, {});
  }

  /**
   * @param {String} htmlName
   * @param {(ctx: State) => any} callback
   */
  static addRegistrationCallback(htmlName, callback) {
    if (this?.ctxMap?.[htmlName]) {
      callback(this.ctxMap[htmlName]);
      return;
    }
    if (!this.cbMap) {
      this.cbMap = Object.create(null);
    }
    if (!this.cbMap[htmlName]) {
      this.cbMap[htmlName] = new Set();
    }
    this.cbMap[htmlName].add(callback);
  }

  /**
   * @param {String} htmlName
   * @param {State} ctx
   */
  static registerCfg(htmlName, ctx) {
    if (!this.ctxMap) {
      this.ctxMap = Object.create(null);
    }
    this.ctxMap[htmlName] = ctx;
    if (this?.cbMap?.[htmlName]) {
      this.cbMap[htmlName].forEach((cb) => {
        cb(ctx);
      });
    }
  }

  /** @param {String} htmlName */
  static unregisterCfg(htmlName) {
    delete this.ctxMap[htmlName];
    delete this.cbMap[htmlName];
  }

  /** @param {String} htmlName */
  static getCfgCtx(htmlName) {
    return this.ctxMap[htmlName];
  }
}
