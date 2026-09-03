import { html } from 'lit';
import { property } from 'lit/decorators.js';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { inject } from '../../abstract/di/inject';
import { UploaderPublicApi } from '../../abstract/UploaderPublicApi';
import { ChildBlock } from '../../lit/ChildBlock';
import './simple-btn.css';

import '../DropArea/DropArea';
import '../Icon/Icon';

export class SimpleBtn extends ChildBlock {
  public static override styleAttrs = [...super.styleAttrs, 'uc-simple-btn'];

  @inject(ConfigController) private readonly _config!: ConfigController;
  // `api` (UploaderPublicApi) is host-boundary state with no dedicated DI token —
  // it is container-resolved (M-god step 8a), injected here via `@inject`.
  @inject(UploaderPublicApi) private readonly _api!: UploaderPublicApi;

  @property({ attribute: 'dropzone', type: Boolean })
  public dropzone = true;

  private readonly _handleClick = () => {
    this._api.initFlow();
  };

  public override render() {
    const buttonTextKey = this._config.getTracked('multiple') ? 'upload-files' : 'upload-file';
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
