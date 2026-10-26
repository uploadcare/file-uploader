import { html, type TemplateResult } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { type Ref, ref } from 'lit/directives/ref.js';
import { styleMap } from 'lit/directives/style-map.js';
import type { CameraMode } from '../../abstract/cameraModes';
import type { CheckedL10nFunction } from '../../abstract/l10n';
import type { DeviceOption } from './CameraDevices';
import type { CameraView } from './cameraView';
import '../ActivityHeader/ActivityHeader';
import '../Icon/Icon';
import '../Select/Select';

/** Everything the camera template reads: the derived view, the state it can't derive, the refs and the handlers. */
export type CameraTemplateProps = {
  view: CameraView;
  l10n: CheckedL10nFunction;
  activeTab: CameraMode | null;
  cameras: DeviceOption[];
  microphones: DeviceOption[];
  selectedCameraId: string | null;
  selectedMicrophoneId: string | null;
  videoTransform: string | null;
  requestButtonHidden: boolean;
  hasVideoFrame: boolean;
  timelineIcon: string;
  shotLabel: string;
  videoRef: Ref<HTMLVideoElement>;
  timerRef: Ref<HTMLElement>;
  lineRef: Ref<HTMLElement>;
  onBack: () => void;
  onClose: () => void;
  onCameraChange: (event: Event) => void;
  onMicrophoneChange: (event: Event) => void;
  onVideoFrame: () => void;
  onVideoEmptied: () => void;
  onRequestAccess: () => void;
  onTabClick: (event: MouseEvent) => void;
  onToggleClipPlayback: () => void;
  onRetake: () => void;
  onAccept: () => void;
  onShutter: () => void;
  onToggleMicrophone: () => void;
};

export const renderCameraSource = (p: CameraTemplateProps): TemplateResult => html`
     <uc-activity-header>
        <button
          type="button"
          class="uc-mini-btn"
          @click=${p.onBack}
          title=${p.l10n('back')}
        >
          <uc-icon name="back"></uc-icon>
        </button>
        <div ?hidden=${!p.view.cameraSelectHidden}>
          <uc-icon name="camera"></uc-icon>
          <span>${p.l10n('caption-camera')}</span>
        </div>
        <uc-select
          class="uc-camera-select"
          .options=${p.cameras}
          .value=${p.selectedCameraId ?? ''}
          ?hidden=${p.view.cameraSelectHidden}
          @change=${p.onCameraChange}
        >
        </uc-select>
        <button
          type="button"
          class="uc-mini-btn uc-close-btn"
          @click=${p.onClose}
          title=${p.l10n('a11y-activity-header-button-close')}
          aria-label=${p.l10n('a11y-activity-header-button-close')}
        >
          <uc-icon name="close"></uc-icon>
        </button>
      </uc-activity-header>
      <div class="uc-content">
        <video
          muted
          autoplay
          playsinline
          style=${styleMap({
            transform: p.videoTransform,
          })}
          ?hidden=${p.view.videoHidden}
          @loadeddata=${p.onVideoFrame}
          @emptied=${p.onVideoEmptied}
          ${ref(p.videoRef)}
        ></video>
        <div class="uc-message-box" ?hidden=${p.view.messageHidden}>
          <span>${p.l10n(p.view.message)}</span>
          <button
            type="button"
            @click=${p.onRequestAccess}
            ?hidden=${p.requestButtonHidden}
          >
            ${p.l10n('camera-permissions-request')}
          </button>
        </div>
      </div>

      <div class="uc-controls">
        <div class="uc-switcher" ?hidden=${!p.view.timerHidden}>
          <button
            data-id="photo"
            type="button"
            class=${classMap({
              'uc-switch': true,
              'uc-mini-btn': true,
              'uc-active': p.activeTab === 'photo',
            })}
            aria-label=${p.l10n('src-type-mobile-photo-camera')}
            aria-pressed=${p.activeTab === 'photo'}
            @click=${p.onTabClick}
            ?hidden=${p.view.photoTabHidden}
            data-testid="tab-photo"
          >
            <uc-icon name="camera"></uc-icon>
          </button>
          <button
            data-id="video"
            type="button"
            class=${classMap({
              'uc-switch': true,
              'uc-mini-btn': true,
              'uc-active': p.activeTab === 'video',
            })}
            aria-label=${p.l10n('src-type-mobile-video-camera')}
            aria-pressed=${p.activeTab === 'video'}
            @click=${p.onTabClick}
            ?hidden=${p.view.videoTabHidden}
            data-testid="tab-video"
          >
            <uc-icon name="video-camera"></uc-icon>
          </button>
        </div>

        <button
          class="uc-secondary-btn uc-recording-timer"
          @click=${p.onToggleClipPlayback}
          ?hidden=${p.view.timerHidden}
          data-testid="recording-timer"
        >
          <uc-icon name=${p.timelineIcon}></uc-icon>
          <span ${ref(p.timerRef)}> 00:00 </span>
          <span ${ref(p.lineRef)} class="uc-line"></span>
        </button>

        <div
          class="uc-camera-actions uc-camera-action"
          ?hidden=${p.view.actionsHidden}
        >
          <button
            type="button"
            class="uc-secondary-btn"
            @click=${p.onRetake}
          >
            ${p.l10n('retake')}
          </button>
          <button
            type="button"
            class="uc-primary-btn"
            @click=${p.onAccept}
            data-testid="accept"
          >
            ${p.l10n('accept')}
          </button>
        </div>

        <button
          type="button"
          data-testid="shot"
          @click=${p.onShutter}
          class=${p.view.shotClass}
          ?hidden=${p.view.shotHidden}
          ?disabled=${!p.hasVideoFrame}
          aria-label=${p.shotLabel}
        >
          <uc-icon name=${p.view.shotIcon}></uc-icon>
        </button>

        <div class="uc-select">
          <button
            type="button"
            class="uc-mini-btn uc-btn-microphone"
            @click=${p.onToggleMicrophone}
            ?hidden=${p.view.microphoneHidden}
            aria-label=${p.l10n('a11y-camera-microphone')}
            aria-pressed=${p.view.microphoneIcon === 'microphone' ? 'true' : 'false'}
            data-testid="toggle-microphone"
          >
            <uc-icon name=${p.view.microphoneIcon}></uc-icon>
          </button>

          <uc-select
            class="uc-audio-select"
            .options=${p.microphones}
            .value=${p.selectedMicrophoneId ?? ''}
            ?hidden=${p.view.audioSelectHidden}
            ?disabled=${p.view.audioSelectDisabled}
            @change=${p.onMicrophoneChange}
            data-testid="audio-select"
          >
          </uc-select>
        </div>
      </div>
    `;
