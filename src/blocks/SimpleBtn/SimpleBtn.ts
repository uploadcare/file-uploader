import { html } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LitUploaderBlock } from '../../lit/LitUploaderBlock';
import './simple-btn.css';

import '../DropArea/DropArea';
import '../Icon/Icon';

export class SimpleBtn extends LitUploaderBlock {
  public static override styleAttrs = [...super.styleAttrs, 'uc-simple-btn'];
  public override couldBeCtxOwner = true;

  @property({ attribute: 'dropzone', type: Boolean })
  public dropzone = true;

  @state()
  private _buttonTextKey = 'upload-file';

  private readonly _handleClick = () => {
    this.api.initFlow();
  };

  public override initCallback(): void {
    super.initCallback();

    this.subConfigValue('multiple', (val) => {
      this._buttonTextKey = val ? 'upload-files' : 'upload-file';
    });
  }

  public override render() {
    return html`
    <uc-drop-area .disabled=${!this.dropzone}>
    <button type="button" @click=${this._handleClick}>
      <uc-icon name="upload"></uc-icon>
      <span>${this.l10n(this._buttonTextKey)}</span>
      ${this.yield('')}
      <div class="uc-visual-drop-area">${this.l10n('drop-files-here')}</div>
    </button>
  </uc-drop-area>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-simple-btn': SimpleBtn;
  }
}
