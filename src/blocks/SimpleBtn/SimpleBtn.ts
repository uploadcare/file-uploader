import { html } from 'lit';
import { property, state } from 'lit/decorators.js';
import '../../blocks/SimpleBtn/simple-btn.css';
import '../DropArea/DropArea';
import '../Icon/Icon';
import { ChildBlock } from '../../abstract/ChildBlock';
import type { UploaderController } from '../../abstract/controllers/UploaderController';

/**
 * v2 `<uc-simple-btn>`. Trigger button that opens the upload flow.
 * Click delegates to `api.open()`. The button label tracks v1's
 * `multiple` config to flip between `upload-file` / `upload-files`.
 *
 * Markup mirrors v1 exactly so `simple-btn.css` applies — the
 * `uc-simple-btn` style attribute is added via `styleAttrs` (v1
 * parity).
 */
export class SimpleBtn extends ChildBlock {
  public static override styleAttrs = [...super.styleAttrs, 'uc-simple-btn'];

  @property({ attribute: 'dropzone', type: Boolean })
  public dropzone = true;

  @state()
  private _buttonTextKey = 'upload-file';

  protected override controllerReady(ctrl: UploaderController): void {
    this._syncButtonTextKey(ctrl);
  }

  public override updated(): void {
    const ctrl = this.uploaderOrNull;
    if (ctrl) this._syncButtonTextKey(ctrl);
  }

  private _syncButtonTextKey(ctrl: UploaderController): void {
    const multiple = (ctrl.config.values as { multiple?: boolean }).multiple;
    const next = multiple ? 'upload-files' : 'upload-file';
    if (next !== this._buttonTextKey) this._buttonTextKey = next;
  }

  private readonly _handleClick = (): void => {
    this.uploader.api.open();
  };

  public override render() {
    const t = (key: string): string => this.uploaderOrNull?.locale.t(key) ?? key;
    return html`
      <uc-drop-area .disabled=${!this.dropzone}>
        <button type="button" @click=${this._handleClick}>
          <uc-icon name="upload"></uc-icon>
          <span>${t(this._buttonTextKey)}</span>
          ${this.yield('')}
          <div class="uc-visual-drop-area">${t('drop-files-here')}</div>
        </button>
      </uc-drop-area>
    `;
  }
}

if (!customElements.get('uc-simple-btn')) customElements.define('uc-simple-btn', SimpleBtn);
