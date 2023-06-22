// @ts-check
import { Block } from '../../abstract/Block.js';
import { initialConfig } from './initialConfig.js';
import { sharedConfigKey } from '../../abstract/sharedConfigKey.js';
import { toKebabCase } from '../../utils/toKebabCase.js';
import { normalizeConfigValue } from './normalizeConfigValue.js';

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

export class Config extends Block {
  ctxOwner = true;

  /** @type {Block['init$'] & import('../../types').ConfigType} */
  init$ = {
    ...this.init$,
    ...Object.fromEntries(
      Object.entries(initialConfig).map(([key, value]) => [
        sharedConfigKey(/** @type {keyof ConfigType} */ (key)),
        value,
      ])
    ),
  };

  constructor() {
    super();

    if (this.hasAttribute('override')) {
      this.ctxOwner = false;
    }

    allConfigKeys.forEach((key) => {
      Object.defineProperty(this, key, {
        /** @param {unknown} value */
        set: (value) => {
          // wait for state to be initialized
          setTimeout(() => {
            if (this.$[sharedConfigKey(key)] !== value) {
              if (typeof value === 'undefined' || value === null) {
                this.$[sharedConfigKey(key)] = initialConfig[key];
              } else {
                this.$[sharedConfigKey(key)] = value;
              }
            }
          });
        },
        get: () => {
          return this.$[sharedConfigKey(key)];
        },
      });
    });
  }

  /**
   * @param {keyof typeof attrStateMapping} name
   * @param {string} oldVal
   * @param {string} newVal
   */
  attributeChangedCallback(name, oldVal, newVal) {
    const normalizedVal = normalizeConfigValue(attrKeyMapping[name], newVal);
    super.attributeChangedCallback(name, oldVal, normalizedVal ?? initialConfig[attrKeyMapping[name]]);
  }
}

Config.bindAttributes(attrStateMapping);
