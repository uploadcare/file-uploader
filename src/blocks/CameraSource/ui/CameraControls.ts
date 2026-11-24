import { html, nothing, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { createRef, ref } from 'lit/directives/ref.js';
import type { CameraMode } from '../../../abstract/cameraModes';
import { ChildBlock } from '../../../lit/ChildBlock';
import { effect } from '../../../lit/effect';
import type { ClockView } from '../cameraTypes';
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

  /** The control that had focus before this render, which may remove it: the shutter after a shot, accept after it. */
  private _focused: HTMLElement | null = null;

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    const active = document.activeElement;
    this._focused = active instanceof HTMLElement && this.contains(active) ? active : null;
  }

  // A removed control drops its focus to the page. It goes on to what took its place: accept once something is
  // captured, the shutter once that is resolved.
  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    if (this._focused?.isConnected === false) {
      this.querySelector<HTMLElement>('.uc-camera-actions .uc-primary-btn, .uc-shot-btn')?.focus();
    }
  }

  private readonly _emit = (action: CameraActionEvent['action']) => this.dispatchEvent(new CameraActionEvent(action));

  /** Names the shutter after its icon, which is what tells sighted users what a press does next. */
  private _shotLabel(icon: CameraView['shotIcon']): string {
    if (icon === 'square') return this.l10n('a11y-camera-stop-recording');
    if (icon === 'video-camera-full') {
      return this.l10n('record', { source: this.l10n('src-type-mobile-video-camera') });
    }
    return this.l10n('camera-shot');
  }

  private _renderTab(tab: CameraMode, icon: string, label: string) {
    return html`
      <button
        data-id=${tab}
        type="button"
        class=${classMap({ 'uc-switch': true, 'uc-mini-btn': true, 'uc-active': this.activeTab === tab })}
        aria-label=${label}
        aria-pressed=${this.activeTab === tab}
        @click=${() => this._emit({ type: 'select-tab', tab })}
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
        ${
          view.timerHidden
            ? html`
                <div class="uc-switcher">
                  ${view.photoTabHidden ? nothing : this._renderTab('photo', 'camera', this.l10n('src-type-mobile-photo-camera'))}
                  ${view.videoTabHidden ? nothing : this._renderTab('video', 'video-camera', this.l10n('src-type-mobile-video-camera'))}
                </div>
              `
            : html`
                <button
                  type="button"
                  class="uc-secondary-btn uc-recording-timer"
                  @click=${() => this._emit({ type: 'toggle-playback' })}
                  ?disabled=${view.timerDisabled}
                  aria-label=${view.timerDisabled ? nothing : this.l10n(`a11y-camera-${this.timelineIcon}`)}
                  data-testid="recording-timer"
                >
                  <uc-icon name=${this.timelineIcon}></uc-icon>
                  <span>${this.clock?.timerText ?? '00:00'}</span>
                  <span ${ref(this._line)} class="uc-line"></span>
                </button>
              `
        }
        ${
          view.actionsHidden
            ? nothing
            : html`
                <div class="uc-camera-actions uc-camera-action">
                  <button
                    type="button"
                    class="uc-secondary-btn"
                    @click=${() => this._emit({ type: 'retake' })}
                    data-testid="retake"
                  >
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
              `
        }
        ${
          view.shotHidden
            ? nothing
            : html`
                <button
                  type="button"
                  data-testid="shot"
                  @click=${() => this._emit({ type: 'shutter' })}
                  class=${view.shotClass}
                  ?disabled=${!this.hasVideoFrame}
                  aria-label=${this._shotLabel(view.shotIcon)}
                >
                  <uc-icon name=${view.shotIcon}></uc-icon>
                </button>
              `
        }

        <div class="uc-select">
          ${
            view.microphoneHidden
              ? nothing
              : html`
                  <button
                    type="button"
                    class="uc-mini-btn uc-btn-microphone"
                    @click=${() => {
                      if (!view.microphoneDisabled) this._emit({ type: 'toggle-microphone' });
                    }}
                    aria-label=${this.l10n(view.microphoneLabel)}
                    aria-disabled=${view.microphoneDisabled ? 'true' : 'false'}
                    aria-pressed=${view.microphoneIcon === 'microphone' ? 'true' : 'false'}
                    data-testid="toggle-microphone"
                  >
                    <uc-icon name=${view.microphoneIcon}></uc-icon>
                  </button>
                `
          }

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
