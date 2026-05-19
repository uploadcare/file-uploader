import { html, LitElement, type TemplateResult, unsafeCSS } from 'lit';
import { property } from 'lit/decorators.js';

import {
  type AiCapability,
  type AiEditorMode,
  type AiTemplate,
  CAPABILITIES,
  CAPABILITIES_FOR_MODE,
} from '../../capabilities';
import styles from './chips.css?inline';

export type TemplateSelectDetail = { template: AiTemplate };

export class UcAiChips extends LitElement {
  public static override styles = unsafeCSS(styles);

  @property()
  public mode: AiEditorMode = 'generate';

  @property()
  public capability: AiCapability = 'generate';

  @property()
  public prompt = '';

  @property({ type: Boolean })
  public busy = false;

  @property({ attribute: 'aria-label-text' })
  public override ariaLabel: string | null = 'Quick prompts';

  private _select(template: AiTemplate): void {
    this.dispatchEvent(
      new CustomEvent<TemplateSelectDetail>('uc:select', { detail: { template }, bubbles: true, composed: true }),
    );
  }

  public override render(): TemplateResult {
    const templates: AiTemplate[] = CAPABILITIES_FOR_MODE[this.mode].flatMap((id) => CAPABILITIES[id].templates);

    return html`
      <div class="row" role="toolbar" aria-label="${this.ariaLabel ?? ''}">
        ${templates.map(
          (tpl) => html`
            <button
              type="button"
              class="chip"
              aria-pressed="${this.capability === tpl.capability && this.prompt === tpl.prompt}"
              @click=${() => this._select(tpl)}
              ?disabled=${this.busy}
            >
              ${tpl.label}
            </button>
          `,
        )}
      </div>
    `;
  }
}

if (!customElements.get('uc-ai-chips')) {
  customElements.define('uc-ai-chips', UcAiChips);
}
