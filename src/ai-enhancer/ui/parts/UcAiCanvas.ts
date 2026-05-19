import { html, LitElement, nothing, type TemplateResult, unsafeCSS } from 'lit';
import { property } from 'lit/decorators.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';

import { ICON_IMAGE } from '../icons';
import styles from './canvas.css?inline';

export class UcAiCanvas extends LitElement {
  public static override styles = unsafeCSS(styles);

  @property()
  public url: string | null = null;

  @property({ type: Boolean })
  public busy = false;

  @property()
  public alt = '';

  @property({ attribute: 'busy-label' })
  public busyLabel = '';

  @property({ attribute: 'empty-hint' })
  public emptyHint = '';

  public override render(): TemplateResult {
    return html`
      <div class="canvas" data-state="${this.url ? 'filled' : 'empty'}">
        ${
          this.url
            ? html`<img src="${this.url}" alt="${this.alt || 'AI image'}" />`
            : html`
              <div class="empty-hint">
                ${unsafeSVG(ICON_IMAGE)}
                <span>${this.emptyHint}</span>
              </div>
            `
        }
        ${
          this.busy
            ? html`<div class="busy-overlay"><div class="spinner" role="progressbar" aria-label="${this.busyLabel}"></div></div>`
            : nothing
        }
      </div>
    `;
  }
}

if (!customElements.get('uc-ai-canvas')) {
  customElements.define('uc-ai-canvas', UcAiCanvas);
}
