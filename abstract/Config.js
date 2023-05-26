// @ts-check
import { Block } from './Block.js';
import { initialConfig } from './initialConfig.js';
import { sharedConfigKey } from './sharedConfigKey.js';

export class Config extends Block {
  /** @type {Block['init$'] & import('./initialConfig.js').Config} */
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
          this.$[key] = value;
        },
        get: () => {
          return this.$[key];
        },
      });
    });
  }
}

Config.bindAttributes(Object.fromEntries(Object.keys(initialConfig).map((key) => [key, sharedConfigKey(key)])));
