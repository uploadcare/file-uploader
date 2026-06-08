import { html, LitElement } from 'lit';
import '../../blocks/Spinner/spinner.css';
import { LightDomMixin } from '../../lit/LightDomMixin';

/**
 * v2 `<uc-spinner>`. Pure visual element — no state, no controller. v1's
 * `spinner.css` styles `uc-spinner` directly so we inherit visuals.
 *
 * Extends `LightDomMixin(LitElement)` instead of `ChildBlock` because the
 * spinner doesn't need access to an `UploaderController`. Keeps the
 * component independent and importable in isolation.
 */
export class Spinner extends LightDomMixin(LitElement) {
  public override render() {
    return html`<div class="uc-spinner"></div>`;
  }
}

if (!customElements.get('uc-spinner')) customElements.define('uc-spinner', Spinner);
