import { html, LitElement, nothing, type TemplateResult, unsafeCSS } from 'lit';
import { property, query } from 'lit/decorators.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';

import type { AiEditorMode } from '../../capabilities';
import { ICON_ARROW_THICK, ICON_HISTORY } from '../icons';
import styles from './prompt-row.css?inline';

export type PromptInputDetail = { value: string };

export class UcAiPromptRow extends LitElement {
  public static override styles = unsafeCSS(styles);

  @property()
  public mode: AiEditorMode = 'generate';

  @property()
  public value = '';

  @property()
  public placeholder = '';

  @property({ type: Boolean })
  public busy = false;

  @property({ type: Boolean, attribute: 'history-open' })
  public historyOpen = false;

  @property({ attribute: 'history-aria-label' })
  public historyAriaLabel = '';

  @property({ attribute: 'send-aria-label' })
  public sendAriaLabel = '';

  @query('.input')
  private _inputEl?: HTMLInputElement;

  public focusInput(): void {
    this._inputEl?.focus();
  }

  private _onInput(e: Event): void {
    const value = (e.target as HTMLInputElement).value;
    this.value = value;
    this.dispatchEvent(
      new CustomEvent<PromptInputDetail>('uc:input', { detail: { value }, bubbles: true, composed: true }),
    );
  }

  private _onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && this.value.trim()) {
      e.preventDefault();
      this._emitSend();
    }
  }

  private _emitSend(): void {
    this.dispatchEvent(new CustomEvent('uc:send', { bubbles: true, composed: true }));
  }

  private _emitToggleHistory(): void {
    this.dispatchEvent(new CustomEvent('uc:toggle-history', { bubbles: true, composed: true }));
  }

  public override render(): TemplateResult {
    const showHistory = this.mode === 'edit' && !this.value;
    const showArrow = this.mode === 'edit' && this.value.trim().length > 0;

    return html`
      <div class="row">
        ${
          showHistory
            ? html`
              <button
                type="button"
                class="icon-btn"
                aria-label="${this.historyAriaLabel}"
                aria-expanded="${this.historyOpen}"
                @click=${this._emitToggleHistory}
              >
                ${unsafeSVG(ICON_HISTORY)}
              </button>
              <div class="divider" role="separator"></div>
            `
            : nothing
        }
        <input
          class="input"
          type="text"
          .value=${this.value}
          placeholder="${this.placeholder}"
          aria-label="${this.placeholder}"
          @input=${this._onInput}
          @keydown=${this._onKeydown}
          ?disabled=${this.busy}
        />
        ${
          showArrow
            ? html`
              <button
                type="button"
                class="icon-btn icon-btn--primary"
                aria-label="${this.sendAriaLabel}"
                @click=${this._emitSend}
                ?disabled=${this.busy || !this.value.trim()}
              >
                ${unsafeSVG(ICON_ARROW_THICK)}
              </button>
            `
            : nothing
        }
      </div>
    `;
  }
}

if (!customElements.get('uc-ai-prompt-row')) {
  customElements.define('uc-ai-prompt-row', UcAiPromptRow);
}
