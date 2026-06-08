import { html } from 'lit';
import { property } from 'lit/decorators.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import '../../blocks/Icon/icon.css';
import { ChildBlock } from '../../abstract/ChildBlock';
import type { UploaderController } from '../../abstract/controllers/UploaderController';

/**
 * v2 `<uc-icon>`. Resolves `name` against the icon registry on the
 * uploader controller; falls back to the SVG sprite href
 * (`#uc-icon-{name}`) if not registered. Honors `config.iconHrefResolver`
 * for custom URL resolution.
 *
 * Drop-in for v1's `<uc-icon>`: same tag, same attributes, same CSS rules
 * (v1's `icon.css` keys off the tag name).
 */
export class Icon extends ChildBlock {
  @property({ type: String })
  public name = '';

  protected override subscriptionsFor(ctrl: UploaderController) {
    return [
      // Icon name → SVG comes from the plugin registry; re-render on
      // registry changes (plugin installs override icons).
      ctrl.plugins.subscribe.bind(ctrl.plugins),
      // iconHrefResolver lives in config.
      ctrl.config.subscribe.bind(ctrl.config),
    ];
  }

  public override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('aria-hidden', 'true');
  }

  public override render() {
    if (!this.name) return this.yield('');

    const ctrl = this.uploaderOrNull;
    const svg = ctrl?.plugins.icon(this.name);
    if (svg) {
      return html`${this.yield('', html`${unsafeSVG(svg)}`)}`;
    }

    const resolver = ctrl?.config.values.iconHrefResolver as ((name: string) => string) | null | undefined;
    const href = resolver?.(this.name) ?? `#uc-icon-${this.name}`;
    return html`
      ${this.yield(
        '',
        html`<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <use href=${href}></use>
        </svg>`,
      )}
    `;
  }
}

if (!customElements.get('uc-icon')) customElements.define('uc-icon', Icon);
