// @ts-check
import { Block } from '../../abstract/Block.js';
import { initialConfig } from '../../abstract/initialConfig.js';
import { sharedConfigKey } from '../../abstract/sharedConfigKey.js';

export class Config extends Block {
  /** @type {Block['init$'] & import('../../abstract/initialConfig.js').Config} */
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
}

Config.bindAttributes(Object.fromEntries(Object.keys(initialConfig).map((key) => [key, sharedConfigKey(key)])));
