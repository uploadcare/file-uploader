import { html, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LitUploaderBlock } from '../../lit/LitUploaderBlock';
import './source-btn.css';

import '../Icon/Icon';

export type SourceButtonConfig = {
  id: string;
  label: string;
  icon?: string;
  onClick: () => void | Promise<void>;
};

export class SourceBtn extends LitUploaderBlock {
  public override couldBeCtxOwner = true;

  @property({ attribute: false })
  public source?: SourceButtonConfig;

  @property({ type: Boolean })
  public textOnly = false;

  @property({ type: Boolean })
  public iconOnly = false;

  @property()
  public customLabel = '';

  @state()
  private _iconName = 'default';

  @state()
  private _label = '';

  protected override willUpdate(changedProperties: PropertyValues<this>): void {
    super.willUpdate(changedProperties);

    if (changedProperties.has('source')) {
      this._applySource(this.source);
    }
  }

  private _applySource(source?: SourceButtonConfig): void {
    if (!source) {
      this._label = '';
      this._iconName = 'default';
      return;
    }

    const { label, icon, id } = source;
    this._label = this.customLabel ? this.customLabel : this.l10n(label);
    this._iconName = icon ?? id ?? 'default';
  }

  public activate(): void {
    if (!this.source) return;
    void this.source.onClick();
  }

  public override render() {
    return html`
      <button type="button" @click=${this.activate}>
        ${this.textOnly ? '' : html`<uc-icon name=${this._iconName}></uc-icon>`}
        ${this.iconOnly ? '' : html`<div class="uc-txt">${this._label}</div>`}
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-source-btn': SourceBtn;
  }
}
