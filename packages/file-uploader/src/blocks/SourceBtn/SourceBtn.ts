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

  @state()
  private _iconName = 'default';

  @state()
  private _srcTypeKey = '';

  protected override willUpdate(changedProperties: PropertyValues<this>): void {
    super.willUpdate(changedProperties);

    if (changedProperties.has('source')) {
      this._applySource(this.source);
    }
  }

  private _applySource(source?: SourceButtonConfig): void {
    if (!source) {
      this._srcTypeKey = '';
      this._iconName = 'default';
      return;
    }

    const { label, icon, id } = source;
    this._srcTypeKey = label;
    this._iconName = icon ?? id ?? 'default';
  }

  public activate(): void {
    if (!this.source) return;
    void this.source.onClick();
  }

  public override render() {
    return html`
      <button type="button" @click=${this.activate}>
        <uc-icon name=${this._iconName}></uc-icon>
        <div class="uc-txt">${this.l10n(this._srcTypeKey)}</div>
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-source-btn': SourceBtn;
  }
}
