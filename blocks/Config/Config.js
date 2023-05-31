// @ts-check
import { Block } from '../../abstract/Block.js';
import { initialConfig } from './initialConfig.js';
import { sharedConfigKey } from '../../abstract/sharedConfigKey.js';
import { toKebabCase } from '../../utils/toKebabCase.js';
import { normalizeConfigValue } from './normalizeConfigValue.js';

const allConfigKeys = /** @type {(keyof import('../../types/exported.js').ConfigType)[]} */ (
  Object.keys(initialConfig)
);

/** @type {Record<string, keyof import('../../types/exported.js').ConfigType>} */
const attrKeyMapping = {
  ...Object.fromEntries(allConfigKeys.map((key) => [toKebabCase(key), key])),
  ...Object.fromEntries(allConfigKeys.map((key) => [key.toLowerCase(), key])),
};

const attrStateMapping = {
  ...Object.fromEntries(allConfigKeys.map((key) => [toKebabCase(key), sharedConfigKey(key)])),
  ...Object.fromEntries(allConfigKeys.map((key) => [key.toLowerCase(), sharedConfigKey(key)])),
};

export class Config extends Block {
  /** @type {Block['init$'] & import('../../types/exported.js').ConfigType} */
  init$ = {
    ...this.init$,
    ...Object.fromEntries(Object.entries(initialConfig).map(([key, value]) => [sharedConfigKey(key), value])),
  };

  constructor() {
    super();

    Object.keys(initialConfig).forEach((key) => {
      Object.defineProperty(this, key, {
        /** @param {unknown} value */
        set: (value) => {
          this.$[sharedConfigKey(key)] = value;
        },
        get: () => {
          return this.$[sharedConfigKey(key)];
        },
      });
    });
  }

  /**
   * @param {string} name
   * @param {string} oldVal
   * @param {string} newVal
   */
  attributeChangedCallback(name, oldVal, newVal) {
    const normalizedVal = normalizeConfigValue(attrKeyMapping[name], newVal);
    super.attributeChangedCallback(name, oldVal, normalizedVal);
  }
}

Config.bindAttributes(attrStateMapping);
