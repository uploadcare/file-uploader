import { html, LitElement } from 'lit';
import '../../blocks/SmartBtn/smart-btn-mode.css';
import { LightDomMixin } from '../../lit/LightDomMixin';

/**
 * v2 `<uc-no-wrap-mode-smart-btn>`. Layout wrapper used by SmartBtn to
 * render its inline source buttons in a single non-wrapping row.
 * Pure CSS — no logic, no controller dependency. Same
 * `[uc-no-wrap-mode-smart-btn]` style attribute as v1.
 */
export class NoWrapModeSmartBtn extends LightDomMixin(LitElement) {
  public static styleAttrs: string[] = ['uc-no-wrap-mode-smart-btn'];

  public override connectedCallback(): void {
    super.connectedCallback();
    const ctor = this.constructor as typeof NoWrapModeSmartBtn;
    for (const attr of ctor.styleAttrs) {
      if (!this.hasAttribute(attr)) this.setAttribute(attr, '');
    }
  }

  public override render() {
    return html`${this.yield('')}`;
  }
}

if (!customElements.get('uc-no-wrap-mode-smart-btn'))
  customElements.define('uc-no-wrap-mode-smart-btn', NoWrapModeSmartBtn);

// Tag is globally declared by v1's `src/blocks/SmartBtn/NoWrapModeSmartBtn.ts`.
