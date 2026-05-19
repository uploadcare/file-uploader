import { html, LitElement, type TemplateResult, unsafeCSS } from 'lit';
import { property } from 'lit/decorators.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';

import { ICON_CHEVRON_LEFT } from '../icons';
import styles from './footer.css?inline';

export class UcAiFooter extends LitElement {
  public static override styles = unsafeCSS(styles);

  @property({ attribute: 'back-label' })
  public backLabel = '';

  @property({ attribute: 'primary-label' })
  public primaryLabel = '';

  @property({ type: Boolean, attribute: 'primary-disabled' })
  public primaryDisabled = false;

  private _emitBack(): void {
    this.dispatchEvent(new CustomEvent('uc:back', { bubbles: true, composed: true }));
  }

  private _emitPrimary(): void {
    this.dispatchEvent(new CustomEvent('uc:primary', { bubbles: true, composed: true }));
  }

  public override render(): TemplateResult {
    return html`
      <div class="footer">
        <button type="button" class="btn" @click=${this._emitBack}>
          ${unsafeSVG(ICON_CHEVRON_LEFT)}
          <span>${this.backLabel}</span>
        </button>
        <button type="button" class="btn btn--primary" @click=${this._emitPrimary} ?disabled=${this.primaryDisabled}>
          <span>${this.primaryLabel}</span>
        </button>
      </div>
    `;
  }
}

if (!customElements.get('uc-ai-footer')) {
  customElements.define('uc-ai-footer', UcAiFooter);
}
