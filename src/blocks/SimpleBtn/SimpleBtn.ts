import { html } from 'lit';
import { property } from 'lit/decorators.js';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import type { UploaderController } from '../../abstract/controllers/UploaderController';
import { UploaderPublicApi } from '../../abstract/UploaderPublicApi';
import { ChildBlock } from '../../lit/ChildBlock';
import './simple-btn.css';

import '../DropArea/DropArea';
import '../Icon/Icon';

export class SimpleBtn extends ChildBlock {
  public static override styleAttrs = [...super.styleAttrs, 'uc-simple-btn'];

  public static override readonly uses = [ConfigController, UploaderPublicApi] as const;

  @property({ attribute: 'dropzone', type: Boolean })
  public dropzone = true;

  // `api` (UploaderPublicApi) is host-boundary state with no dedicated DI token —
  // it is container-resolved (M-god step 8a), reached here via `use()`.
  private readonly _handleClick = () => {
    this.use(UploaderPublicApi).initFlow();
  };

  protected override subscriptionsFor(ctrl: UploaderController) {
    return [(listener: () => void) => ctrl.locale.subscribe(listener)];
  }

  public override render() {
    const buttonTextKey = this.use(ConfigController).getTracked('multiple') ? 'upload-files' : 'upload-file';
    return html`
    <uc-drop-area .disabled=${!this.dropzone}>
    <button type="button" @click=${this._handleClick}>
      <uc-icon name="upload"></uc-icon>
      <span>${this.l10n(buttonTextKey)}</span>
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
