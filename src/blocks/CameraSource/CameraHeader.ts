import { html } from 'lit';
import { property } from 'lit/decorators.js';
import { ChildBlock } from '../../lit/ChildBlock';
import { CameraActionEvent } from './CameraActionEvent';
import type { DeviceOption } from './CameraDevices';
import '../ActivityHeader/ActivityHeader';
import '../Icon/Icon';
import '../Select/Select';

/** The camera's header: back, the caption or the camera picker, close. */
export class CameraHeader extends ChildBlock {
  /** Shows the camera picker in place of the caption. */
  @property({ type: Boolean, attribute: false })
  public pickCamera = false;

  @property({ attribute: false })
  public cameras: DeviceOption[] = [];

  @property({ attribute: false })
  public selectedCameraId: string | null = null;

  private readonly _emit = (action: CameraActionEvent['action']) => this.dispatchEvent(new CameraActionEvent(action));

  private readonly _handleCameraChange = (event: Event): void => {
    const target = event.target as HTMLSelectElement | null;
    if (target) this._emit({ type: 'select-camera', deviceId: target.value });
  };

  public override render() {
    return html`
      <uc-activity-header>
        <button type="button" class="uc-mini-btn" @click=${() => this._emit({ type: 'back' })} title=${this.l10n('back')}>
          <uc-icon name="back"></uc-icon>
        </button>
        <div ?hidden=${this.pickCamera}>
          <uc-icon name="camera"></uc-icon>
          <span>${this.l10n('caption-camera')}</span>
        </div>
        <uc-select
          class="uc-camera-select"
          .options=${this.cameras}
          .value=${this.selectedCameraId ?? ''}
          ?hidden=${!this.pickCamera}
          @change=${this._handleCameraChange}
        >
        </uc-select>
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
