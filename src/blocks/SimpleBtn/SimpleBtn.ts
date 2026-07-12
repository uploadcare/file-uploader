import { html } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { UploaderController } from '../../abstract/controllers/UploaderController';
import { ChildBlock } from '../../lit/ChildBlock';
import './simple-btn.css';

import '../DropArea/DropArea';
import '../Icon/Icon';

export class SimpleBtn extends ChildBlock {
  public static override styleAttrs = [...super.styleAttrs, 'uc-simple-btn'];

  @property({ attribute: 'dropzone', type: Boolean })
  public dropzone = true;

  @state()
  private _buttonTextKey = 'upload-file';

  private readonly _handleClick = () => {
    this.bag.api.initFlow();
  };

  protected override subscriptionsFor(ctrl: UploaderController) {
    return [(listener: () => void) => ctrl.locale.subscribe(listener)];
  }

  protected override controllerReady(): void {
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
