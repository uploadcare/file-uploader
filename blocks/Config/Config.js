// @ts-check
import { Block } from '../../abstract/Block.js';
import { initialConfig } from './initialConfig.js';
import { sharedConfigKey } from '../../abstract/sharedConfigKey.js';
import { toKebabCase } from '../../utils/toKebabCase.js';
import { normalizeConfigValue } from './normalizeConfigValue.js';
import { debounce } from '../utils/debounce.js';

const allConfigKeys = /** @type {(keyof import('../../types').ConfigType)[]} */ (Object.keys(initialConfig));

/**
 * Config keys that can't be passed as atrtibute (because they are object or function)
 *
 * @type {(keyof import('../../types').ConfigComplexType)[]}
 */
const complexConfigKeys = ['metadata'];

/** @type {(key: keyof import('../../types').ConfigType) => key is keyof import('../../types').ConfigComplexType} */
const isComplexKey = (key) => complexConfigKeys.includes(key);

/** Config keys that can be passed as atrtibute */
const plainConfigKeys = /** @type {(keyof import('../../types').ConfigPlainType)[]} */ (
  allConfigKeys.filter((key) => !isComplexKey(key))
);

/**
 * Mapping of attribute names to config keys Kebab-case and lowercase are supported. lowercase could be used by
 * frameworks like vue and react.
 */
const attrKeyMapping =
  /** @type {Record<keyof import('../../types').ConfigAttributesType, keyof import('../../types').ConfigPlainType>} */ ({
    ...Object.fromEntries(plainConfigKeys.map((key) => [toKebabCase(key), key])),
    ...Object.fromEntries(plainConfigKeys.map((key) => [key.toLowerCase(), key])),
  });

/** Mapping of attribute names to state */
const attrStateMapping = /** @type {Record<keyof import('../../types').ConfigAttributesType, string>} */ ({
  ...Object.fromEntries(allConfigKeys.map((key) => [toKebabCase(key), sharedConfigKey(key)])),
  ...Object.fromEntries(allConfigKeys.map((key) => [key.toLowerCase(), sharedConfigKey(key)])),
});

class ConfigClass extends Block {
  requireCtxName = true;

  constructor() {
    super();

    /** @type {Block['init$'] & import('../../types').ConfigType} */
    this.init$ = {
      ...this.init$,
      ...Object.fromEntries(
        Object.entries(initialConfig).map(([key, value]) => [
          sharedConfigKey(/** @type {keyof import('../../types').ConfigType} */ (key)),
          value,
        ]),
      ),
    };
  }

  initCallback() {
    super.initCallback();
    const anyThis = /** @type {typeof this & any} */ (this);

    for (const key of plainConfigKeys) {
      this.sub(
        sharedConfigKey(key),
        (value) => {
          if (value !== initialConfig[key]) {
            anyThis[key] = value;
          }
        },
        false,
      );
    }

    for (const key of allConfigKeys) {
      let localPropName = '__' + key;
      anyThis[localPropName] = anyThis[key];

      Object.defineProperty(this, key, {
        /** @param {unknown} value */
        set: (value) => {
          anyThis[localPropName] = value;
          if (plainConfigKeys.includes(key)) {
            const attrs = [...new Set([toKebabCase(key), key.toLowerCase()])];
            for (const attr of attrs) {
              if (typeof value === 'undefined' || value === null) {
                this.removeAttribute(attr);
              } else {
                this.setAttribute(attr, value.toString());
              }
            }
          }
          if (this.$[sharedConfigKey(key)] !== value) {
            if (typeof value === 'undefined' || value === null) {
              this.$[sharedConfigKey(key)] = initialConfig[key];
            } else {
              this.$[sharedConfigKey(key)] = value;
            }
          }
        },
        get: () => {
          return this.$[sharedConfigKey(key)];
        },
      });

      if (typeof anyThis[key] !== 'undefined' && anyThis[key] !== null) {
        anyThis[key] = anyThis[localPropName];
      }
    }
  }

  /**
   * @param {keyof typeof attrStateMapping} name
   * @param {string} oldVal
   * @param {string} newVal
   */
  attributeChangedCallback(name, oldVal, newVal) {
    if (oldVal === newVal) return;

    const key = attrKeyMapping[name];
    const normalizedVal = normalizeConfigValue(key, newVal);
    const val = normalizedVal ?? initialConfig[key];

    const anyThis = /** @type {typeof this & any} */ (this);
    anyThis[key] = val;
  }

  /** @private */
  _debugPrint = debounce(() => {
    /** @type {Partial<Record<keyof import('../../types').ConfigType, never>>} */
    const config = Object.create(null);
    for (const key of allConfigKeys) {
      config[key] = this.$[sharedConfigKey(key)];
    }
    this.debugPrint('config', config);
  }, 0);
}

ConfigClass.bindAttributes(attrStateMapping);

/** @typedef {import('../../utils/mixinClass.js').MixinClass<typeof ConfigClass, import('../../types').ConfigType>} Config */

// This is workaround for jsdoc that allows us to export extended class type along with the class itself
export const Config = /** @type {Config} */ (/** @type {unknown} */ (ConfigClass));
