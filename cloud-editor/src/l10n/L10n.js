import { State } from '../../../symbiote/core/State.js';
import { ASSETS_LOCALES_URL } from '../paths.js';
import { LOCALES } from '../env.js';

const DEFAULT_PLURAL_STRINGS = {
  'file#': {
    zero: 'file',
    one: 'file',
    two: 'files',
    few: 'files',
    many: 'files',
    other: 'files',
  },
};
const DEFAULT_LOCALE = 'en-EN';
const CTX_NAME = 'l10n';

export class L10n {
  /** @param {String} str */
  static _log(str, locName) {
    if (locName && locName !== DEFAULT_LOCALE) {
      console.warn(`Translation needed for: "${str}"`);
    }
  }

  /**
   * @param {Object} locMap
   * @param {String} str
   * @param {Number} num
   */
  static pluralize(locMap, str, num) {
    let localeName = this.localeName || DEFAULT_LOCALE;
    return (locMap || DEFAULT_PLURAL_STRINGS)[str][new Intl.PluralRules(localeName).select(num)] || str;
  }

  /**
   * @param {String} str
   * @param {Number} [number]
   */
  static t(str, number) {
    let translation = str;
    if (number !== undefined && str.includes('#')) {
      let map = this.localeMap && this.localeMap[str] && this.localeMap;
      translation = this.pluralize(map, str, number);
    } else if (this.custom?.[str] || this.localeMap?.[str]) {
      translation = this.custom?.[str] || this.localeMap?.[str];
    } else {
      this._log(str, this.localeName);
    }
    return translation;
  }

  static notify() {
    window.dispatchEvent(new CustomEvent(CTX_NAME));
  }

  static applyTranslations(trMap) {
    for (let lStr in trMap) {
      this.state.add(lStr, trMap[lStr]);
    }
    this.notify();
  }

  static applyCustom(trMap) {
    this.custom = { ...trMap };
    for (let str in this.custom) {
      this.state.notify(str);
    }
    this.notify();
  }

  static async _loadLocale(localeName) {
    let isLocaleSupported = LOCALES.includes(localeName);
    let localeUrl;

    if (isLocaleSupported) {
      localeUrl = `${ASSETS_LOCALES_URL}/${localeName}.json`;
    } else {
      // TODO: get user's url from config
      let msg = `Locale "${localeName}" is not supported`;
      let error = new Error(msg);
      console.error(msg, { error, payload: { supportedLocales: LOCALES } });
      throw error;
    }

    try {
      return await (await fetch(localeUrl)).json();
    } catch (error) {
      console.error(`Failed to load locale "${localeName}"`, { error, payload: { localeUrl } });
      throw error;
    }
  }

  /** @param {String} localeName */
  static async applyLocale(localeName) {
    if (this._lastLocaleName === localeName) {
      return;
    }
    if (!this.state) {
      let localeMap = new Proxy(Object.create(null), {
        set: (target, prop, val) => {
          this.localeMap[prop] = val;
          return true;
        },
        get: (target, prop) => {
          return this.custom?.[prop] || this.localeMap?.[prop] || prop;
        },
      });
      State.registerNamedCtx(CTX_NAME, localeMap);
      this.state = State.getNamedCtx(CTX_NAME);
    }
    this.localeName = localeName;
    try {
      if (localeName) {
        if (localeName === DEFAULT_LOCALE) {
          this.localeMap = {};
        } else {
          this.localeMap = await this._loadLocale(localeName);
        }
        this.applyTranslations(this.localeMap);
      }
    } catch (err) {
      this.applyLocale(DEFAULT_LOCALE);
    }
    this._lastLocaleName = localeName;
  }

  static init() {
    this.applyLocale(DEFAULT_LOCALE);
  }
}

L10n.init();
