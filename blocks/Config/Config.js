// @ts-check
import { Block } from '../../abstract/Block.js';
import { initialConfig } from './initialConfig.js';
import { sharedConfigKey } from '../../abstract/sharedConfigKey.js';
import { toKebabCase } from '../../utils/toKebabCase.js';
import { normalizeConfigValue } from './normalizeConfigValue.js';

const allConfigKeys = /** @type {(keyof import('../../types/exported.js').ConfigType)[]} */ (
  Object.keys(initialConfig)
);

/**
 * Config keys that can't be passed as atrtibute (because they are object or function)
 *
 * @type {(keyof import('../../index.js').ComplexConfigType)[]}
 */
const complexConfigKeys = ['metadata'];

/**
 * @type {(
 *   key: keyof import('../../types/exported.js').ConfigType
 * ) => key is keyof import('../../index.js').ComplexConfigType}
 */
const isComplexKey = (key) => complexConfigKeys.includes(key);

/** Config keys that can be passed as atrtibute */
const plainConfigKeys = /** @type {(keyof import('../../index.js').PlainConfigType)[]} */ (
  allConfigKeys.filter((key) => !isComplexKey(key))
);

/**
 * Mapping of attribute names to config keys Kebab-case and lowercase are supported. lowercase could be used by
 * frameworks like vue and react.
 */
const attrKeyMapping = /**
 * @type {Record<
 *   keyof import('../../index.js').KebabCaseKeys<import('../../types/exported.js').ConfigType> &
 *     keyof import('../../index.js').LowerCaseKeys<import('../../types/exported.js').ConfigType>,
 *   keyof import('../../index.js').PlainConfigType
 * >}
 */ ({
  ...Object.fromEntries(plainConfigKeys.map((key) => [toKebabCase(key), key])),
  ...Object.fromEntries(plainConfigKeys.map((key) => [key.toLowerCase(), key])),
});

/** Mapping of attribute names to state */
const attrStateMapping = /**
 * @type {Record<
 *   keyof import('../../index.js').KebabCaseKeys<import('../../types/exported.js').ConfigType> &
 *     keyof import('../../index.js').LowerCaseKeys<import('../../types/exported.js').ConfigType>,
 *   string
 * >}
 */ ({
  ...Object.fromEntries(allConfigKeys.map((key) => [toKebabCase(key), sharedConfigKey(key)])),
  ...Object.fromEntries(allConfigKeys.map((key) => [key.toLowerCase(), sharedConfigKey(key)])),
});

export class Config extends Block {
  /** @type {Block['init$'] & import('../../types/exported.js').ConfigType} */
  init$ = {
    ...this.init$,
    ...Object.fromEntries(Object.entries(initialConfig).map(([key, value]) => [sharedConfigKey(key), value])),
  };

  constructor() {
    super();

    allConfigKeys.forEach((key) => {
      Object.defineProperty(this, key, {
        /** @param {unknown} value */
        set: (value) => {
          // wait for state to be initialized
          setTimeout(() => {
            if (this.$[sharedConfigKey(key)] !== value) {
              this.$[sharedConfigKey(key)] = value;
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
    super.attributeChangedCallback(name, oldVal, normalizedVal);
  }
}

Config.bindAttributes(attrStateMapping);
