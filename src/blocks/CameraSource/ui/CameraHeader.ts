import { html } from 'lit';
import { ChildBlock } from '../../../lit/ChildBlock';
import { CameraActionEvent } from './CameraActionEvent';
import '../../ActivityHeader/ActivityHeader';
import '../../Icon/Icon';

/** The camera's header: back, the caption, close. The camera picker is in the settings. */
export class CameraHeader extends ChildBlock {
  private readonly _emit = (action: CameraActionEvent['action']) => this.dispatchEvent(new CameraActionEvent(action));

  public override render() {
    return html`
      <uc-activity-header>
        <button type="button" class="uc-mini-btn" @click=${() => this._emit({ type: 'back' })} title=${this.l10n('back')}>
          <uc-icon name="back"></uc-icon>
        </button>
        <div>
          <uc-icon name="camera"></uc-icon>
          <span>${this.l10n('caption-camera')}</span>
        </div>
        <button
          type="button"
          class="uc-mini-btn uc-close-btn"
          @click=${() => this._emit({ type: 'close' })}
          title=${this.l10n('a11y-activity-header-button-close')}
          aria-label=${this.l10n('a11y-activity-header-button-close')}
        >
          <uc-icon name="close"></uc-icon>
        </button>
      </uc-activity-header>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-camera-header': CameraHeader;
  }
}
