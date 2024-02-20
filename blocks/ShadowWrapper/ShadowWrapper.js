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

    /**
     * @private
     *
     *   This is super tricky workaround to wait for shadow styles to load. When `shadowStyles` is defined, symbiote will
     *   wait for it to load before rendering the component. So the `render` method becomes async. We need to call
     *   `shadowReadyCallback` right after the rendering is done. But we can't just call it after `render` because it's
     *   async. So we need to wait for the shadow styles to load and then call `shadowReadyCallback`.
     */
    async _waitForShadowStylesLoad() {
      if (!this.shadowRoot) {
        return;
      }
      // @ts-expect-error
      const shadowStylesUrl = this.constructor['__shadowStylesUrl'];
      /** @type {HTMLLinkElement | null} */
      const link = this.shadowRoot.querySelector(`link[href="${shadowStylesUrl}"]`);

      if (!link) {
        return;
      }

      await new Promise((resolve, reject) => {
        link.addEventListener('load', resolve);
        link.addEventListener('error', reject);
      });
    }

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
            window.requestAnimationFrame(async () => {
              this.render();
              await this._waitForShadowStylesLoad();
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
