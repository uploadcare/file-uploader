import { html, LitElement } from 'lit';
import '../../blocks/DynamicBtn/dynamic-btn-mode.css';
import { LightDomMixin } from '../../lit/LightDomMixin';

/**
 * v2 `<uc-no-wrap-mode-dynamic-btn>`. Layout wrapper used by DynamicBtn to
 * render its inline source buttons in a single non-wrapping row.
 * Pure CSS — no logic, no controller dependency. Same
 * `[uc-no-wrap-mode-dynamic-btn]` style attribute as v1.
 */
export class NoWrapModeDynamicBtn extends LightDomMixin(LitElement) {
  public static styleAttrs: string[] = ['uc-no-wrap-mode-dynamic-btn'];

  public override connectedCallback(): void {
    super.connectedCallback();
    const ctor = this.constructor as typeof NoWrapModeDynamicBtn;
    for (const attr of ctor.styleAttrs) {
      if (!this.hasAttribute(attr)) this.setAttribute(attr, '');
    }
  }

  public override render() {
    return html`${this.yield('')}`;
  }
}

if (!customElements.get('uc-no-wrap-mode-dynamic-btn'))
  customElements.define('uc-no-wrap-mode-dynamic-btn', NoWrapModeDynamicBtn);

// Tag is globally declared by v1's `src/blocks/DynamicBtn/NoWrapModeDynamicBtn.ts`.
