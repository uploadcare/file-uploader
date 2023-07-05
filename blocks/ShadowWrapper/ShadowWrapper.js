// @ts-check
import { Block } from '../../abstract/Block.js';

const CSS_ATTRIBUTE = 'css-src';

/**
 * @template T
 * @typedef {new (...args: any[]) => T} GConstructor
 */

/**
 * @template {GConstructor<import('../../abstract/Block.js').Block>} T
 * @param {T} Base
 * @returns {T}
 */
export const shadowed = (Base) => {
  return class extends Base {
    renderShadow = true;
    pauseRender = true;

    shadowReadyCallback() {}

    initCallback() {
      super.initCallback();
      this.setAttribute('hidden', '');

      // async wait for attributes to be set, needed for Angular because it sets attributes after constructor
      setTimeout(() => {
        let href = this.getAttribute(CSS_ATTRIBUTE);
        if (href) {
          this.attachShadow({
            mode: 'open',
          });
          let link = document.createElement('link');
          link.rel = 'stylesheet';
          link.type = 'text/css';
          link.href = href;
          link.onload = () => {
            // CSS modules can be not loaded at this moment
            // TODO: investigate better solution
            window.requestAnimationFrame(() => {
              this.render();
              window.setTimeout(() => {
                this.removeAttribute('hidden');
                this.shadowReadyCallback();
              });
            });
          };
          // @ts-ignore TODO: fix this
          this.shadowRoot.prepend(link);
        } else {
          throw new Error('css-src attribute is required');
        }
      });
    }
  };
};

export const ShadowWrapper = shadowed(Block);
