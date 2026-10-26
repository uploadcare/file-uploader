import { html, type PropertyValues } from 'lit';
import { state } from 'lit/decorators.js';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { RouterController } from '../../abstract/controllers/RouterController';
import { inject } from '../../abstract/di/inject';
import { isAbortError } from '../../abstract/di/Lifetime';
import { TelemetryManager } from '../../abstract/managers/TelemetryManager';
import { UploaderPublicApi } from '../../abstract/UploaderPublicApi';
import { ChildBlock } from '../../lit/ChildBlock';
import { effect } from '../../lit/effect';
import { debounced } from '../../lit/rate-limited-method';
import { canUsePermissionsApi } from '../../utils/abilities';
import { UploadSource } from '../../utils/UploadSource';
import './camera-source.css';
import { classMap } from 'lit/directives/class-map.js';
import { createRef, ref } from 'lit/directives/ref.js';
import { styleMap } from 'lit/directives/style-map.js';
import { parseCameraModes } from '../../abstract/cameraModes';
import { CameraDevices, type DeviceOption } from './CameraDevices';
import { CameraRecorder, createCameraFile, RecordingClock } from './CameraRecorder';
import { type CameraPermission, type CameraPhase, type CameraView, deriveCameraView } from './cameraView';
import { CameraSourceEvents, CameraSourceTypes } from './constants';

import '../ActivityHeader/ActivityHeader';
import '../Icon/Icon';
import '../Select/Select';

const DEFAULT_VIDEO_CONFIG = {
  width: {
    ideal: 1920,
  },
  height: {
    ideal: 1080,
  },
  frameRate: {
    ideal: 30,
  },
};

/** The current device stays selected while it is still listed; otherwise the first one takes over. */
const keepListedDeviceId = (devices: { value: string }[], currentId: string | null): string | null =>
  devices.some((device) => device.value === currentId) ? currentId : (devices[0]?.value ?? null);

const DEFAULT_PICTURE_FORMAT = 'image/jpeg';

import type { CameraMode } from '../../abstract/cameraModes';

export type { CameraMode };
export type CameraStatus = 'shot' | 'retake' | 'accept' | 'play' | 'stop' | 'pause' | 'resume';

const stopTracks = (stream: MediaStream): void => {
  for (const track of stream.getTracks()) track.stop();
};

export class CameraSource extends ChildBlock {
  @inject(ConfigController) private readonly _config!: ConfigController;
  @inject(RouterController) private readonly _router!: RouterController;
  @inject(TelemetryManager) private readonly _telemetry!: TelemetryManager;
  // `UploaderPublicApi` is read from `_toSend` (a capture handler that runs
  // post-adoption), so `@inject` resolves it safely.
  @inject(UploaderPublicApi) private readonly _api!: UploaderPublicApi;

  private _capturing = false;

  private readonly _recorder = new CameraRecorder();
  private readonly _clock = new RecordingClock();

  private _stream: MediaStream | null = null;

  @state()
  private _selectedAudioId: string | null = null;

  @state()
  private _selectedCameraId: string | null = null;

  @state()
  private _activeTab: CameraMode | null = null;
  private _canvas: HTMLCanvasElement | null = null;
  private _ctx: CanvasRenderingContext2D | null = null;
  @state()
  private _cameraDevices: DeviceOption[] = [];
  @state()
  private _audioDevices: DeviceOption[] = [];
  private readonly _devices = new CameraDevices({
    whileAdopted: (work, dispose) => this.whileAdopted(work, dispose),
    runTask: (task) => this.runTask(task),
    adoptionSignal: () => this.adoptionSignal,
    audioEnabled: () => this._config.get('enableAudioRecording'),
    cameraLabel: (index) => `${this.l10n('caption-camera')} ${index + 1}`,
    onPermissionChange: () => this.runTask(() => this._capture()),
    onDevicesChange: ({ cameras, microphones }) => this._applyDevices(cameras, microphones),
    onError: (error, context, message) => {
      this._log.warn(message, error);
      this._telemetry.sendEventError(error, context);
    },
  });
  private _currentVideoSource: MediaStream | null = null;
  /** Object URL of the recorded clip being previewed; revoked when the preview is replaced or the camera released. */
  private _previewUrl: string | null = null;

  private readonly _handlePreviewPlay = (): void => {
    this._clock.startTimeline(
      () => this._videoRef.value,
      () => this._lineRef.value,
      () => this._timerRef.value,
    );
    this._currentTimelineIcon = 'pause';
  };

  private readonly _handlePreviewPause = (): void => {
    this._currentTimelineIcon = 'play';
    this._clock.stop();
  };

  private _timerRef = createRef<HTMLElement>();
  private _lineRef = createRef<HTMLElement>();
  private _videoRef = createRef<HTMLVideoElement>();

  // Tracked read: `cameraMirror` auto-tracks under `SignalWatcher`, so a config
  // change re-renders the video transform — replacing the v1
  // `subConfigValue('cameraMirror')` mirror into a `_videoTransformCss` @state.
  private get _videoTransformCss(): string | null {
    return this._config.getTracked('cameraMirror') ? 'scaleX(-1)' : null;
  }

  private readonly _requestBtnHidden = canUsePermissionsApi();

  @state()
  private _permission: CameraPermission = 'idle';

  @state()
  private _phase: CameraPhase = 'live';

  @state()
  private _audioMuted = false;

  @state()
  private _cameraSelectOptions: DeviceOption[] = [];

  @state()
  private _hasVideoFrame = false;

  @state()
  private _audioSelectOptions: DeviceOption[] = [];

  @state()
  private _currentTimelineIcon = 'play';

  private _chooseActionWithCamera = () => {
    this._telemetry.sendActionEvent('start-camera', this.tagName, { tabId: this._activeTab });

    if (this._activeTab === CameraSourceTypes.PHOTO) {
      this._shot();
    }

    if (this._activeTab === CameraSourceTypes.VIDEO) {
      if (this._recorder.isRecording) {
        this._stopRecording();
        return;
      }

      this._startRecording();
    }
  };

  private _handleCameraSelectChange = (event: Event): void => {
    const target = event.target as HTMLSelectElement | null;
    if (!target) {
      return;
    }
    this._selectedCameraId = target.value;
    this.runTask(() => this._capture());
  };

  private _handleAudioSelectChange = (event: Event): void => {
    const target = event.target as HTMLSelectElement | null;
    if (!target) {
      return;
    }
    this._selectedAudioId = target.value;
    this.runTask(() => this._capture());
  };

  private _handleRequestPermissions = (): void => {
    this.runTask(() => this._capture());
  };

  private _handleStartCamera = (): void => {
    this._telemetry.sendActionEvent('shot-camera', this.tagName, { tabId: this._activeTab });
    this._chooseActionWithCamera();
  };

  private _handleToggleRecording = (): void => {
    this._toggleRecording();
  };

  private _handleToggleAudio = (): void => {
    this._toggleEnableAudio();
  };

  private _handleRetake = (): void => {
    this._telemetry.sendActionEvent('retake-camera', this.tagName, { tabId: this._activeTab });
    this._retake();
  };

  private _handleAccept = (): void => {
    this._telemetry.sendActionEvent('accept-camera', this.tagName, { tabId: this._activeTab });
    this._accept();
  };

  private _handleClickTab = (event: MouseEvent): void => {
    const target = event.currentTarget as HTMLElement | null;
    const id = target?.getAttribute('data-id');
    if (id) {
      this._handleActiveTab(id as CameraMode);
    }
  };

  private _startRecording = (): void => {
    try {
      if (this._stream) {
        this._recorder.start(this._stream, this._config.get('mediaRecorderOptions') ?? {});
        this._clock.startTimer(
          () => this._timerRef.value,
          () => this._config.get('maxVideoRecordingDuration') ?? undefined,
          () => this._stopRecording(),
        );

        this.classList.add('uc-recording');
        this._setCameraState(CameraSourceEvents.PLAY);
      }
    } catch (error) {
      this._log.error('Failed to start recording', error);
      this._telemetry.sendEventError(error, 'camera recording. Failed to start recording');
    }
  };

  private _stopRecording = (): void => {
    this._recorder.stop(() => {
      this._previewVideo();
      this._clock.stop();
      this._setCameraState(CameraSourceEvents.STOP);
    });
    this.classList.remove('uc-recording');

    this._telemetry.sendActionEvent('stop-camera', this.tagName, { tabId: this._activeTab });
  };

  /** This method is used to toggle recording pause/resume */
  private _toggleRecording = (): void => {
    if (this._recorder.isRecording) return;

    const videoEl = this._videoRef.value;
    if (!videoEl) return;
    if (!videoEl.paused && !videoEl.ended && videoEl.readyState > 2) {
      videoEl.pause();
    } else if (videoEl.paused) {
      this.runTask(() => videoEl.play());
    }
  };

  private _toggleEnableAudio = (): void => {
    this._stream?.getAudioTracks().forEach((track) => {
      track.enabled = !track.enabled;
      this._audioMuted = !track.enabled;
    });
  };

  /**
   * Previewing the video that was recorded on the camera
   */
  private _previewVideo = (): void => {
    try {
      const blob = this._recorder.clip();

      const videoElement = this._videoRef.value as HTMLVideoElement | undefined;
      if (!videoElement) {
        return;
      }

      this._revokePreviewUrl();
      const videoURL = URL.createObjectURL(blob);
      this._previewUrl = videoURL;

      videoElement.muted = false;
      videoElement.volume = 1;
      this._setVideoSource(null);
      videoElement.src = videoURL;

      this._attachPreviewListeners(videoElement);
    } catch (error) {
      this._log.error('Failed to preview video', error);
      this._telemetry.sendEventError(error, 'camera previewing. Failed to preview video');
    }
  };

  private _attachPreviewListeners(videoElement: HTMLVideoElement): void {
    this._detachPreviewListeners(videoElement);
    videoElement.addEventListener('play', this._handlePreviewPlay);
    videoElement.addEventListener('pause', this._handlePreviewPause);
  }

  private _detachPreviewListeners(videoElement?: HTMLVideoElement | null): void {
    videoElement?.removeEventListener('play', this._handlePreviewPlay);
    videoElement?.removeEventListener('pause', this._handlePreviewPause);
  }

  private _revokePreviewUrl(): void {
    if (this._previewUrl) {
      URL.revokeObjectURL(this._previewUrl);
      this._previewUrl = null;
    }
  }

  private _setVideoSource(stream: MediaStream | null): void {
    if (this._currentVideoSource === stream) {
      return;
    }
    this._currentVideoSource = stream;
    this._applyVideoSource();
  }

  /**
   * Do not bind srcObject directly in the template, because it stops video pausing on shot.
   * I really don'y know why but that's how it is. Assigning srcObject manually fixes the issue.
   */
  private _applyVideoSource(): void {
    const videoElement = this._videoRef.value;
    if (!videoElement) {
      return;
    }
    const nextSource = this._currentVideoSource ?? null;
    if (videoElement.srcObject !== nextSource) {
      videoElement.srcObject = nextSource;
    }
  }

  private _retake = (): void => {
    this._setCameraState(CameraSourceEvents.RETAKE);

    /** Reset video */
    if (this._activeTab === CameraSourceTypes.VIDEO) {
      this._revokePreviewUrl();
      this._setVideoSource(this._stream);
      const videoElement = this._videoRef.value as HTMLVideoElement | undefined;
      if (videoElement) {
        videoElement.muted = true;
      }
    }

    const videoEl = this._videoRef.value;
    if (videoEl) {
      this.runTask(() => videoEl.play());
    }
  };

  // The shutter waits for a frame: a shot before the first one draws an empty canvas, which accepting turns into
  // nothing at all.
  private _handleVideoFrame = (): void => {
    this._hasVideoFrame = true;
  };

  private _handleVideoEmptied = (): void => {
    this._hasVideoFrame = false;
  };

  private _accept = (): void => {
    this._setCameraState(CameraSourceEvents.ACCEPT);

    if (this._activeTab === CameraSourceTypes.PHOTO) {
      this._canvas?.toBlob((blob) => {
        if (!blob) {
          return;
        }
        const file = createCameraFile('camera', 'jpeg', DEFAULT_PICTURE_FORMAT, blob);
        this._toSend(file);
      }, DEFAULT_PICTURE_FORMAT);
      return;
    }

    this._toSend(this._recorder.takeFile());
  };

  private _setCameraState = (status: CameraStatus): void => {
    if (status === CameraSourceEvents.RETAKE || status === CameraSourceEvents.ACCEPT) {
      this._phase = 'live';
    } else if (this._activeTab === CameraSourceTypes.PHOTO && status === CameraSourceEvents.SHOT) {
      this._phase = 'shot';
    } else if (this._activeTab === CameraSourceTypes.VIDEO && status === CameraSourceEvents.PLAY) {
      this._phase = 'recording';
    } else if (this._activeTab === CameraSourceTypes.VIDEO && status === CameraSourceEvents.STOP) {
      this._phase = 'recorded';
    }
  };

  private _shot(): void {
    this._setCameraState('shot');

    this._canvas = document.createElement('canvas');
    this._ctx = this._canvas.getContext('2d');

    if (!this._ctx) {
      throw new Error('Failed to get canvas context');
    }
    const videoEl = this._videoRef.value;
    if (!videoEl) {
      throw new Error('Video element not found');
    }
    this._canvas.height = videoEl.videoHeight;
    this._canvas.width = videoEl.videoWidth;

    if (this._config.get('cameraMirror')) {
      this._ctx.translate(this._canvas.width, 0);
      this._ctx.scale(-1, 1);
    }

    this._ctx.drawImage(videoEl, 0, 0);
    // TODO: There are troubles with this, image isn't freezed after shot due to rendering in progress
    videoEl.pause();
  }

  private _handleActiveTab = (tabId: CameraMode): void => {
    if (tabId === CameraSourceTypes.VIDEO) {
      this._currentTimelineIcon = 'play';
    }

    this._telemetry.sendActionEvent('camera-tab-switch', this.tagName, { tabId });

    this._activeTab = tabId;
  };

  /**
   * The send file to the server
   */
  private _toSend = (file: File): void => {
    this._api.addFileFromObject(file, { source: UploadSource.CAMERA });

    this._router.traverse('onFileAdd');
  };

  private get _cameraModes(): CameraMode[] {
    return parseCameraModes(this._config.get('cameraModes'));
  }

  // `@debounced` drops a call after release and cancels a pending one, so the body reads `@inject` fields freely.
  /** @internal */
  @debounced(300)
  protected _setPermissionsState(state: 'granted' | 'denied' | 'prompt'): void {
    this.classList.toggle('uc-initialized', state === 'granted');
    this._permission = state;
    if (state === 'prompt') {
      this._stopCapture();
      return;
    }
    // A new stream, or none: whatever was captured from the previous one is gone.
    this._phase = 'live';
    if (state === 'denied') {
      this._stopCapture();
    }
  }

  private _makeStreamInactive = (): boolean => {
    if (!this._stream) return false;

    const audioTracks = this._stream?.getAudioTracks();
    const videoTracks = this._stream?.getVideoTracks();

    audioTracks.forEach((track) => {
      track.stop();
    });
    videoTracks.forEach((track) => {
      track.stop();
    });

    return true;
  };

  private _stopCapture = (): void => {
    if (this._capturing) {
      if (this._videoRef.value) {
        this._videoRef.value.volume = 0;
      }
      const tracks = this._currentVideoSource?.getTracks?.();
      tracks?.[0]?.stop();
      this._detachPreviewListeners(this._videoRef.value);
      this._setVideoSource(null);

      this._makeStreamInactive();
      this._clock.stop();

      this._capturing = false;
    }
  };

  private _capture = async (): Promise<void> => {
    // Release the current stream first. The `'prompt'` state below used to do it, but that setter is debounced and a
    // quick `'granted'` supersedes it, which left the previous camera running after a device switch.
    this._stopCapture();
    const enableAudioRecording = this._config.get('enableAudioRecording');
    const constraints: MediaStreamConstraints = {
      video: { ...DEFAULT_VIDEO_CONFIG },
      audio: enableAudioRecording ? ({} as MediaTrackConstraints) : false,
    };

    if (this._selectedCameraId) {
      constraints.video = {
        deviceId: {
          exact: this._selectedCameraId,
        },
      } as MediaTrackConstraints;
    }

    if (this._selectedAudioId && enableAudioRecording) {
      constraints.audio = {
        deviceId: {
          exact: this._selectedAudioId,
        },
      } as MediaTrackConstraints;
    }

    // Mute the video to prevent feedback for Firefox
    if (this._videoRef.value) {
      this._videoRef.value.volume = 0;
    }

    try {
      this._setPermissionsState('prompt');
      this._stream = await this.whileAdopted(navigator.mediaDevices.getUserMedia(constraints), stopTracks);

      this._stream.addEventListener('inactive', () => {
        this._setPermissionsState('denied');
      });

      this._setVideoSource(this._stream);
      this._capturing = true;
      // The new stream's microphone starts on.
      this._audioMuted = false;
      this._setPermissionsState('granted');
    } catch (error) {
      if (isAbortError(error)) throw error;
      this._setPermissionsState('denied');
      this._log.warn('Failed to capture camera', error);
      this._telemetry.sendEventError(error, 'camera capturing. Failed to capture camera');
    }
  };

  private _applyDevices(cameras: DeviceOption[], microphones: DeviceOption[]): void {
    this._cameraDevices = cameras;
    this._audioDevices = microphones;

    this._cameraSelectOptions = cameras;
    this._selectedCameraId = keepListedDeviceId(cameras, this._selectedCameraId);

    this._audioSelectOptions = microphones;
    this._selectedAudioId = keepListedDeviceId(microphones, this._selectedAudioId);
  }

  private _onActivate = async (): Promise<void> => {
    // Without the Permissions API, ask for the camera straight away.
    if (!(await this._devices.watchPermissions())) {
      this.runTask(() => this._capture());
    }
    await this._devices.requestAccess();
    await this._capture();

    this._handleCameraModes(this._cameraModes);
  };

  private _onDeactivate = (): void => {
    /** Calling this method here because safari and firefox don't support the inactive event yet */
    const isChromium = Boolean((window as Window & { chrome?: unknown }).chrome);
    if (!isChromium) {
      this._setPermissionsState('denied');
    }

    this._stopCapture();
  };

  private _handleCameraModes = (cameraModes: CameraMode[]): void => {
    const defaultTab = cameraModes[0];
    if (defaultTab && (!this._activeTab || !cameraModes.includes(this._activeTab))) {
      this._handleActiveTab(defaultTab);
    }
  };

  protected override controllerReady(): void {
    this.runTask(() => this._onActivate());
  }

  // Picks the default tab when `cameraModes` changes. `beforeUpdate` fires it eagerly and synchronously on adoption,
  // before `_onActivate`'s awaited work runs, then again on change. What the modes show and hide is read in render.
  /** @internal */
  @effect({ beforeUpdate: true })
  protected _syncCameraModes(): void {
    if (!this.isConnected) return;
    this._handleCameraModes(parseCameraModes(this._config.getTracked('cameraModes')));
  }

  public override firstUpdated(changedProperties: PropertyValues<this>): void {
    super.firstUpdated(changedProperties);
    this._applyVideoSource();
  }

  public override updated(changedProperties: PropertyValues<this>): void {
    super.updated(changedProperties);
    this._applyVideoSource();
  }

  private _destroy(): void {
    this._devices.stopWatchingPermissions();
    this._detachPreviewListeners(this._videoRef.value);
    this._setVideoSource(null);
    this._revokePreviewUrl();
  }

  // Camera activation is adoption-scoped (`_onActivate` runs in `controllerReady`),
  // so release the stream + device/permission listeners in `controllerReleased`
  // — invoked on disconnect (via the base `disconnectedCallback` →
  // `_releaseController`) and additionally on ctx release/re-adoption, which the
  // old disconnect-only path missed (re-adoption re-activated without first
  // deactivating).
  protected override controllerReleased(): void {
    this._onDeactivate();
    this._destroy();
  }

  /** Names the shutter after its icon, which is what tells sighted users what a press does next. */
  private _shotLabel(icon: CameraView['shotIcon']): string {
    if (icon === 'square') return this.l10n('a11y-camera-stop-recording');
    if (icon === 'video-camera-full') {
      return this.l10n('record', { source: this.l10n('src-type-mobile-video-camera') });
    }
    return this.l10n('camera-shot');
  }

  private get _view(): CameraView {
    const audioEnabled = this._config.getTracked('enableAudioRecording');
    return deriveCameraView({
      permission: this._permission,
      phase: this._phase,
      tab: this._activeTab,
      cameraModes: parseCameraModes(this._config.getTracked('cameraModes')),
      audioEnabled,
      cameraCount: this._cameraDevices.length,
      microphoneCount: audioEnabled ? this._audioDevices.length : 0,
      muted: this._audioMuted,
    });
  }

  public override render() {
    const view = this._view;
    return html`
     <uc-activity-header>
        <button
          type="button"
          class="uc-mini-btn"
          @click=${() => this._router.traverse('onBack')}
          title=${this.l10n('back')}
        >
          <uc-icon name="back"></uc-icon>
        </button>
        <div ?hidden=${!view.cameraSelectHidden}>
          <uc-icon name="camera"></uc-icon>
          <span>${this.l10n('caption-camera')}</span>
        </div>
        <uc-select
          class="uc-camera-select"
          .options=${this._cameraSelectOptions}
          .value=${this._selectedCameraId ?? ''}
          ?hidden=${view.cameraSelectHidden}
          @change=${this._handleCameraSelectChange}
        >
        </uc-select>
        <button
          type="button"
          class="uc-mini-btn uc-close-btn"
          @click=${() => this._router.traverse('onClose')}
          title=${this.l10n('a11y-activity-header-button-close')}
          aria-label=${this.l10n('a11y-activity-header-button-close')}
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
            transform: this._videoTransformCss,
          })}
          ?hidden=${view.videoHidden}
          @loadeddata=${this._handleVideoFrame}
          @emptied=${this._handleVideoEmptied}
          ${ref(this._videoRef)}
        ></video>
        <div class="uc-message-box" ?hidden=${view.messageHidden}>
          <span>${this.l10n(view.message)}</span>
          <button
            type="button"
            @click=${this._handleRequestPermissions}
            ?hidden=${this._requestBtnHidden}
          >
            ${this.l10n('camera-permissions-request')}
          </button>
        </div>
      </div>

      <div class="uc-controls">
        <div class="uc-switcher" ?hidden=${!view.timerHidden}>
          <button
            data-id="photo"
            type="button"
            class=${classMap({
              'uc-switch': true,
              'uc-mini-btn': true,
              'uc-active': this._activeTab === CameraSourceTypes.PHOTO,
            })}
            aria-label=${this.l10n('src-type-mobile-photo-camera')}
            aria-pressed=${this._activeTab === CameraSourceTypes.PHOTO}
            @click=${this._handleClickTab}
            ?hidden=${view.photoTabHidden}
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
              'uc-active': this._activeTab === CameraSourceTypes.VIDEO,
            })}
            aria-label=${this.l10n('src-type-mobile-video-camera')}
            aria-pressed=${this._activeTab === CameraSourceTypes.VIDEO}
            @click=${this._handleClickTab}
            ?hidden=${view.videoTabHidden}
            data-testid="tab-video"
          >
            <uc-icon name="video-camera"></uc-icon>
          </button>
        </div>

        <button
          class="uc-secondary-btn uc-recording-timer"
          @click=${this._handleToggleRecording}
          ?hidden=${view.timerHidden}
          data-testid="recording-timer"
        >
          <uc-icon name=${this._currentTimelineIcon}></uc-icon>
          <span ${ref(this._timerRef)}> 00:00 </span>
          <span ${ref(this._lineRef)} class="uc-line"></span>
        </button>

        <div
          class="uc-camera-actions uc-camera-action"
          ?hidden=${view.actionsHidden}
        >
          <button
            type="button"
            class="uc-secondary-btn"
            @click=${this._handleRetake}
          >
            ${this.l10n('retake')}
          </button>
          <button
            type="button"
            class="uc-primary-btn"
            @click=${this._handleAccept}
            data-testid="accept"
          >
            ${this.l10n('accept')}
          </button>
        </div>

        <button
          type="button"
          data-testid="shot"
          @click=${this._handleStartCamera}
          class=${view.shotClass}
          ?hidden=${view.shotHidden}
          ?disabled=${!this._hasVideoFrame}
          aria-label=${this._shotLabel(view.shotIcon)}
        >
          <uc-icon name=${view.shotIcon}></uc-icon>
        </button>

        <div class="uc-select">
          <button
            type="button"
            class="uc-mini-btn uc-btn-microphone"
            @click=${this._handleToggleAudio}
            ?hidden=${view.microphoneHidden}
            aria-label=${this.l10n('a11y-camera-microphone')}
            aria-pressed=${view.microphoneIcon === 'microphone' ? 'true' : 'false'}
            data-testid="toggle-microphone"
          >
            <uc-icon name=${view.microphoneIcon}></uc-icon>
          </button>

          <uc-select
            class="uc-audio-select"
            .options=${this._audioSelectOptions}
            .value=${this._selectedAudioId ?? ''}
            ?hidden=${view.audioSelectHidden}
            ?disabled=${view.audioSelectDisabled}
            @change=${this._handleAudioSelectChange}
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
    'uc-camera-source': CameraSource;
  }
}
