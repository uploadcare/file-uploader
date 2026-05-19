import { html, LitElement, type PropertyValues, type TemplateResult, unsafeCSS } from 'lit';
import { property } from 'lit/decorators.js';

import type { HistoryEntry } from '../../controllers/GenerationController';
import styles from './history-popover.css?inline';

export type HistorySelectDetail = { entry: HistoryEntry };

export class UcAiHistoryPopover extends LitElement {
  public static override styles = unsafeCSS(styles);

  @property({ type: Boolean })
  public open = false;

  @property({ attribute: false })
  public entries: HistoryEntry[] = [];

  @property({ attribute: 'empty-label' })
  public emptyLabel = '';

  public override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute('popover')) {
      this.setAttribute('popover', 'auto');
    }
    this.addEventListener('toggle', this._onToggle);
  }

  public override disconnectedCallback(): void {
    this.removeEventListener('toggle', this._onToggle);
    super.disconnectedCallback();
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (!changed.has('open')) return;
    const isOpen = this.matches(':popover-open');
    if (this.open && !isOpen) this.showPopover();
    else if (!this.open && isOpen) this.hidePopover();
  }

  private _onToggle = (e: Event): void => {
    if ((e as ToggleEvent).newState === 'closed' && this.open) {
      this.open = false;
      this.dispatchEvent(new CustomEvent('uc:close', { bubbles: true, composed: true }));
    }
  };

  private _select(entry: HistoryEntry): void {
    this.dispatchEvent(
      new CustomEvent<HistorySelectDetail>('uc:select', { detail: { entry }, bubbles: true, composed: true }),
    );
  }

  public override render(): TemplateResult {
    return html`
      <div class="pop" role="listbox">
        ${
          this.entries.length === 0
            ? html`<div class="empty">${this.emptyLabel}</div>`
            : this.entries.map(
                (entry) => html`
                <button type="button" class="item" role="option" @click=${() => this._select(entry)}>
                  <img class="thumb" src="${entry.url}" alt="" loading="lazy" />
                  <span class="text">${entry.prompt}</span>
                </button>
              `,
              )
        }
      </div>
    `;
  }
}

if (!customElements.get('uc-ai-history-popover')) {
  customElements.define('uc-ai-history-popover', UcAiHistoryPopover);
}
