import { html, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { createRef, ref } from 'lit/directives/ref.js';
import type { CameraMode } from '../../../abstract/cameraModes';
import { ChildBlock } from '../../../lit/ChildBlock';
import { effect } from '../../../lit/effect';
import type { ClockView } from '../media/RecordingClock';
import { CameraActionEvent } from './CameraActionEvent';
import type { CameraView } from './cameraView';
import type { SettingSectionData } from './settingsView';
import '../../Icon/Icon';
import './camera-controls.css';

/**
 * The camera's controls: the tab switcher, the recording timer, accept and retake, the shutter, the microphone and the
 * settings.
 */
export class CameraControls extends ChildBlock {
  @property({ attribute: false })
  public view: CameraView | null = null;

  @property({ attribute: false })
  public activeTab: CameraMode | null = null;

  /** The settings popup's sections, devices included. */
  @property({ attribute: false })
  public settings: SettingSectionData[] = [];

  /** The camera's own shape, for the native ratio's icon. */
  @property({ attribute: false })
  public previewShape: { width: number; height: number } | null = null;

  @property({ attribute: false })
  public settingsHidden = true;

  /** The shutter waits for a frame: a shot before the first one draws an empty canvas. */
  @property({ attribute: false })
  public hasVideoFrame = false;

  /** The recorded clip's play/pause icon. */
  @property({ attribute: false })
  public timelineIcon: 'play' | 'pause' = 'play';

  /** The recording timer and the clip's timeline. Set before the first render, which the timeline's effect relies on. */
  @property({ attribute: false })
  public clock: ClockView | null = null;

  private readonly _line = createRef<HTMLElement>();

  private readonly _emit = (action: CameraActionEvent['action']) => this.dispatchEvent(new CameraActionEvent(action));

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

  /**
   * Moves the timeline bar as the clip plays. An effect rather than a render read: the progress changes every frame, and
   * re-rendering the controls for it ran their whole template 60 times a second.
   * @internal
   */
  @effect()
  protected _moveTimeline(): void {
    const progress = this.clock?.progress ?? null;
    const line = this._line.value;
    if (line) line.style.transform = progress === null ? '' : `scaleX(${progress})`;
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
          type="button"
          class="uc-secondary-btn uc-recording-timer"
          @click=${() => this._emit({ type: 'toggle-playback' })}
          ?hidden=${view.timerHidden}
          ?disabled=${view.timerDisabled}
          aria-label=${view.timerDisabled ? nothing : this.l10n(`a11y-camera-${this.timelineIcon}`)}
          data-testid="recording-timer"
        >
          <uc-icon name=${this.timelineIcon}></uc-icon>
          <span>${this.clock?.timerText ?? '00:00'}</span>
          <span ${ref(this._line)} class="uc-line"></span>
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

          <uc-camera-settings
            .buttonHidden=${this.settingsHidden}
            .sections=${this.settings}
            .previewShape=${this.previewShape}
          ></uc-camera-settings>
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
