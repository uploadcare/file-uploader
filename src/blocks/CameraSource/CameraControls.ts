import { html } from 'lit';
import { property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { createRef, ref } from 'lit/directives/ref.js';
import type { CameraMode } from '../../abstract/cameraModes';
import { ChildBlock } from '../../lit/ChildBlock';
import { CameraActionEvent } from './CameraActionEvent';
import type { DeviceOption } from './CameraDevices';
import type { CameraView } from './cameraView';
import '../Icon/Icon';
import '../Select/Select';
import './camera-controls.css';

/** The camera's controls: the tab switcher, the recording timer, accept and retake, the shutter and the microphone. */
export class CameraControls extends ChildBlock {
  @property({ attribute: false })
  public view: CameraView | null = null;

  @property({ attribute: false })
  public activeTab: CameraMode | null = null;

  @property({ attribute: false })
  public microphones: DeviceOption[] = [];

  @property({ attribute: false })
  public selectedMicrophoneId: string | null = null;

  /** The shutter waits for a frame: a shot before the first one draws an empty canvas. */
  @property({ type: Boolean, attribute: false })
  public hasVideoFrame = false;

  /** The recorded clip's play/pause icon. */
  @property({ attribute: false })
  public timelineIcon = 'play';

  private readonly _timerRef = createRef<HTMLElement>();
  private readonly _lineRef = createRef<HTMLElement>();

  /** Where the recording time is written. */
  public get timer(): HTMLElement | undefined {
    return this._timerRef.value;
  }

  /** The bar that follows the clip's playback. */
  public get timeline(): HTMLElement | undefined {
    return this._lineRef.value;
  }

  private readonly _emit = (action: CameraActionEvent['action']) => this.dispatchEvent(new CameraActionEvent(action));

  private readonly _handleMicrophoneChange = (event: Event): void => {
    const target = event.target as HTMLSelectElement | null;
    if (target) this._emit({ type: 'select-microphone', deviceId: target.value });
  };

  /** Names the shutter after its icon, which is what tells sighted users what a press does next. */
  private _shotLabel(icon: CameraView['shotIcon']): string {
    if (icon === 'square') return this.l10n('a11y-camera-stop-recording');
    if (icon === 'video-camera-full') {
      return this.l10n('record', { source: this.l10n('src-type-mobile-video-camera') });
    }
    return this.l10n('camera-shot');
  }

  private _renderTab(tab: CameraMode, icon: string, label: string, hidden: boolean) {
    return html`
      <button
        data-id=${tab}
        type="button"
        class=${classMap({ 'uc-switch': true, 'uc-mini-btn': true, 'uc-active': this.activeTab === tab })}
        aria-label=${label}
        aria-pressed=${this.activeTab === tab}
        @click=${() => this._emit({ type: 'select-tab', tab })}
        ?hidden=${hidden}
        data-testid=${`tab-${tab}`}
      >
        <uc-icon name=${icon}></uc-icon>
      </button>
    `;
  }

  public override render() {
    const view = this.view;
    if (!view) return html``;
    return html`
      <div class="uc-controls">
        <div class="uc-switcher" ?hidden=${!view.timerHidden}>
          ${this._renderTab('photo', 'camera', this.l10n('src-type-mobile-photo-camera'), view.photoTabHidden)}
          ${this._renderTab('video', 'video-camera', this.l10n('src-type-mobile-video-camera'), view.videoTabHidden)}
        </div>

        <button
          class="uc-secondary-btn uc-recording-timer"
          @click=${() => this._emit({ type: 'toggle-playback' })}
          ?hidden=${view.timerHidden}
          data-testid="recording-timer"
        >
          <uc-icon name=${this.timelineIcon}></uc-icon>
          <span ${ref(this._timerRef)}> 00:00 </span>
          <span ${ref(this._lineRef)} class="uc-line"></span>
        </button>

        <div class="uc-camera-actions uc-camera-action" ?hidden=${view.actionsHidden}>
          <button type="button" class="uc-secondary-btn" @click=${() => this._emit({ type: 'retake' })}>
            ${this.l10n('retake')}
          </button>
          <button
            type="button"
            class="uc-primary-btn"
            @click=${() => this._emit({ type: 'accept' })}
            data-testid="accept"
          >
            ${this.l10n('accept')}
          </button>
        </div>

        <button
          type="button"
          data-testid="shot"
          @click=${() => this._emit({ type: 'shutter' })}
          class=${view.shotClass}
          ?hidden=${view.shotHidden}
          ?disabled=${!this.hasVideoFrame}
          aria-label=${this._shotLabel(view.shotIcon)}
        >
          <uc-icon name=${view.shotIcon}></uc-icon>
        </button>

        <div class="uc-select">
          <button
            type="button"
            class="uc-mini-btn uc-btn-microphone"
            @click=${() => this._emit({ type: 'toggle-microphone' })}
            ?hidden=${view.microphoneHidden}
            aria-label=${this.l10n('a11y-camera-microphone')}
            aria-pressed=${view.microphoneIcon === 'microphone' ? 'true' : 'false'}
            data-testid="toggle-microphone"
          >
            <uc-icon name=${view.microphoneIcon}></uc-icon>
          </button>

          <uc-select
            class="uc-audio-select"
            .options=${this.microphones}
            .value=${this.selectedMicrophoneId ?? ''}
            ?hidden=${view.audioSelectHidden}
            ?disabled=${view.audioSelectDisabled}
            @change=${this._handleMicrophoneChange}
            data-testid="audio-select"
          >
          </uc-select>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-camera-controls': CameraControls;
  }
}
