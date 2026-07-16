import { LitElement } from 'lit';
import { property } from 'lit/decorators.js';
import { LightDomMixin } from '../../lit/LightDomMixin';
import { RegisterableElementMixin } from '../../lit/RegisterableElementMixin';
import { renderIconSvg } from './renderIconSvg';

// Shared icon base — the `name`→sprite rendering. It carries
// `RegisterableElementMixin` so concrete subclasses (e.g. `EditorIcon`) inherit
// the static `reg(tagName)`, but the base itself is intentionally NOT exported
// from any `index.ts`, so `defineComponents(UC)` never registers it as a tag.
export class UcIconBase extends RegisterableElementMixin(LightDomMixin(LitElement)) {
  @property({ type: String })
  public name = '';

  public override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('aria-hidden', 'true');
  }

  public override render() {
    // `yield('', …)` preserves light-DOM child overrides (e.g. a manually
    // provided `<svg>` in place of the sprite `<use>`), matching `uc-icon`'s
    // slotting behavior.
    return this.yield('', this.name ? renderIconSvg(`#uc-icon-${this.name}`) : null);
  }
}
