import { LitElement } from 'lit';
import { property } from 'lit/decorators.js';
import { LightDomMixin } from '../../lit/LightDomMixin';
import { renderIconSvg } from './renderIconSvg';

export class UcIconBase extends LightDomMixin(LitElement) {
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
