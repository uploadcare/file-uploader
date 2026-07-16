import { LitElement } from 'lit';
import { property } from 'lit/decorators.js';
import { LightDomMixin } from '../../lit/LightDomMixin';
import { RegisterableElementMixin } from '../../lit/RegisterableElementMixin';
import { renderIconSvg } from './renderIconSvg';

// `RegisterableElementMixin` provides the static `reg(tagName)` that
// `defineComponents` calls — so subclasses register through the same
// export-then-`defineComponents(UC)` path as every other block, not a
// self-`customElements.define`. It's only the define wrapper — no ctx coupling.
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
