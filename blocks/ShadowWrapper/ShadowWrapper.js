// @ts-check
import { Block } from '../../abstract/Block.js';
import { waitForAttribute } from '../../utils/waitForAttribute.js';

const CSS_ATTRIBUTE = 'css-src';

/**
 * @template {import('../../utils/mixinClass.js').GConstructor<import('../../abstract/Block.js').Block>} T
 * @param {T} Base
 * @returns {import('../../utils/mixinClass.js').MixinClass<
 *   T,
 *   {
 *     shadowReadyCallback(): void;
 *   }
 * >}
 */
export function shadowed(Base) {
  // @ts-ignore
  return class extends Base {
    renderShadow = true;
    pauseRender = true;
    requireCtxName = true;

    shadowReadyCallback() {}

    initCallback() {
      super.initCallback();
      this.setAttribute('hidden', '');

      waitForAttribute({
        element: this,
        attribute: CSS_ATTRIBUTE,
        onSuccess: (href) => {
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
        },
        onTimeout: () => {
          console.error(
            'Attribute `css-src` is required and it is not set. See migration guide: https://uploadcare.com/docs/file-uploader/migration-to-0.25.0/',
          );
        },
      });
    }
  };
}

export class ShadowWrapper extends shadowed(Block) {}
