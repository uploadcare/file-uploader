import type { PropertyValues } from 'lit';
import { html } from 'lit';
import { state } from 'lit/decorators.js';
import { createRef, ref } from 'lit/directives/ref.js';
import { type CameraMode, parseCameraModes } from '../../abstract/cameraModes';
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
import type { CameraActionEvent } from './CameraActionEvent';
import { CameraControls } from './CameraControls';
import { CameraDevices, type DeviceOption } from './CameraDevices';
import { CameraHeader } from './CameraHeader';
import { CameraPreview } from './CameraPreview';
import { CameraRecorder, createCameraFile, RecordingClock } from './CameraRecorder';
import { CameraStream, cameraConstraints, captureFrame } from './CameraStream';
import { type CameraPermission, type CameraPhase, deriveCameraView } from './cameraView';
import { CameraSourceEvents, CameraSourceTypes } from './constants';
import './camera-source.css';

export type { CameraMode };
export type CameraStatus = 'shot' | 'retake' | 'accept' | 'play' | 'stop' | 'pause' | 'resume';

const DEFAULT_PICTURE_FORMAT = 'image/jpeg';

/** The current device stays selected while it is still listed; otherwise the first one takes over. */
const keepListedDeviceId = (devices: { value: string }[], currentId: string | null): string | null =>
  devices.some((device) => device.value === currentId) ? currentId : (devices[0]?.value ?? null);

export class CameraSource extends ChildBlock {
  @inject(ConfigController) private readonly _config!: ConfigController;
  @inject(RouterController) private readonly _router!: RouterController;
  @inject(TelemetryManager) private readonly _telemetry!: TelemetryManager;
  // `UploaderPublicApi` is read from `_toSend` (a capture handler that runs
  // post-adoption), so `@inject` resolves it safely.
  @inject(UploaderPublicApi) private readonly _api!: UploaderPublicApi;

  private readonly _previewRef = createRef<CameraPreview>();
  private readonly _controlsRef = createRef<CameraControls>();

  private readonly _recorder = new CameraRecorder();
  private readonly _clock = new RecordingClock();
  private readonly _camera = new CameraStream({
    video: () => this._previewRef.value?.video,
    onClipPlay: () => {
      this._clock.startTimeline(
        () => this._previewRef.value?.video,
        () => this._controlsRef.value?.timeline,
        () => this._controlsRef.value?.timer,
      );
      this._timelineIcon = 'pause';
    },
    onClipPause: () => {
      this._timelineIcon = 'play';
      this._clock.stop();
    },
  });
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
  /** The photo just taken, until it is accepted or retaken. */
  private _photo: HTMLCanvasElement | null = null;
  private readonly _requestButtonHidden = canUsePermissionsApi();

  @state()
  private _permission: CameraPermission = 'idle';

  @state()
  private _phase: CameraPhase = 'live';

  @state()
  private _activeTab: CameraMode | null = null;

  @state()
  private _cameras: DeviceOption[] = [];

  @state()
  private _microphones: DeviceOption[] = [];

  @state()
  private _selectedCameraId: string | null = null;

  @state()
  private _selectedMicrophoneId: string | null = null;

  @state()
  private _audioMuted = false;

  // The shutter waits for a frame: a shot before the first one draws an empty canvas, which accepting turns into
  // nothing at all.
  @state()
  private _hasVideoFrame = false;

  @state()
  private _timelineIcon = 'play';

  private _handleShutter(): void {
    this._telemetry.sendActionEvent('shot-camera', this.tagName, { tabId: this._activeTab });
    this._telemetry.sendActionEvent('start-camera', this.tagName, { tabId: this._activeTab });
    if (this._activeTab === CameraSourceTypes.PHOTO) {
      this._shot();
    } else if (this._activeTab === CameraSourceTypes.VIDEO) {
      if (this._recorder.isRecording) {
        this._stopRecording();
      } else {
        this._startRecording();
      }
    }
  }

  /** Pauses or resumes the recorded clip's preview. */
  private _handleToggleClipPlayback(): void {
    if (this._recorder.isRecording) return;
    const video = this._previewRef.value?.video;
    if (!video) return;
    if (!video.paused && !video.ended && video.readyState > 2) {
      video.pause();
    } else if (video.paused) {
      this.runTask(() => video.play());
    }
  }

  private _handleToggleMicrophone(): void {
    const muted = this._camera.toggleAudio();
    if (muted !== undefined) this._audioMuted = muted;
  }

  private _handleRetake(): void {
    this._telemetry.sendActionEvent('retake-camera', this.tagName, { tabId: this._activeTab });
    this._setCameraState(CameraSourceEvents.RETAKE);
    if (this._activeTab === CameraSourceTypes.VIDEO) {
      this._camera.showLive();
    }
    const video = this._previewRef.value?.video;
    if (video) {
      this.runTask(() => video.play());
    }
  }

  private _handleAccept(): void {
    this._telemetry.sendActionEvent('accept-camera', this.tagName, { tabId: this._activeTab });
    this._setCameraState(CameraSourceEvents.ACCEPT);
    if (this._activeTab === CameraSourceTypes.PHOTO) {
      this._photo?.toBlob((blob) => {
        if (blob) this._toSend(createCameraFile('camera', 'jpeg', DEFAULT_PICTURE_FORMAT, blob));
      }, DEFAULT_PICTURE_FORMAT);
      return;
    }
    this._toSend(this._recorder.takeFile());
  }

  private _startRecording(): void {
    try {
      const stream = this._camera.stream;
      if (!stream) return;
      this._recorder.start(stream, this._config.get('mediaRecorderOptions') ?? {});
      this._clock.startTimer(
        () => this._controlsRef.value?.timer,
        () => this._config.get('maxVideoRecordingDuration') ?? undefined,
        () => this._stopRecording(),
      );
      this.classList.add('uc-recording');
      this._setCameraState(CameraSourceEvents.PLAY);
    } catch (error) {
      this._log.error('Failed to start recording', error);
      this._telemetry.sendEventError(error, 'camera recording. Failed to start recording');
    }
  }

  private _stopRecording(): void {
    this._recorder.stop(() => {
      try {
        this._camera.showClip(this._recorder.clip());
      } catch (error) {
        this._log.error('Failed to preview video', error);
        this._telemetry.sendEventError(error, 'camera previewing. Failed to preview video');
      }
      this._clock.stop();
      this._setCameraState(CameraSourceEvents.STOP);
    });
    this.classList.remove('uc-recording');
    this._telemetry.sendActionEvent('stop-camera', this.tagName, { tabId: this._activeTab });
  }

  private _shot(): void {
    this._setCameraState(CameraSourceEvents.SHOT);
    const video = this._previewRef.value?.video;
    if (!video) {
      throw new Error('Video element not found');
    }
    this._photo = captureFrame(video, this._config.get('cameraMirror'));
    // TODO: There are troubles with this, image isn't freezed after shot due to rendering in progress
    video.pause();
  }

  private _setCameraState(status: CameraStatus): void {
    if (status === CameraSourceEvents.RETAKE || status === CameraSourceEvents.ACCEPT) {
      this._phase = 'live';
    } else if (this._activeTab === CameraSourceTypes.PHOTO && status === CameraSourceEvents.SHOT) {
      this._phase = 'shot';
    } else if (this._activeTab === CameraSourceTypes.VIDEO && status === CameraSourceEvents.PLAY) {
      this._phase = 'recording';
    } else if (this._activeTab === CameraSourceTypes.VIDEO && status === CameraSourceEvents.STOP) {
      this._phase = 'recorded';
    }
  }

  private _selectTab(tab: CameraMode): void {
    if (tab === CameraSourceTypes.VIDEO) {
      this._timelineIcon = 'play';
    }
    this._telemetry.sendActionEvent('camera-tab-switch', this.tagName, { tabId: tab });
    this._activeTab = tab;
  }

  /** Falls back to the first configured mode when the current tab isn't one. */
  private _selectDefaultTab(cameraModes: CameraMode[]): void {
    const defaultTab = cameraModes[0];
    if (defaultTab && (!this._activeTab || !cameraModes.includes(this._activeTab))) {
      this._selectTab(defaultTab);
    }
  }

  private _toSend(file: File): void {
    this._api.addFileFromObject(file, { source: UploadSource.CAMERA });
    this._router.traverse('onFileAdd');
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

  private _stopCapture(): void {
    if (this._camera.close()) {
      this._clock.stop();
    }
  }

  private async _capture(): Promise<void> {
    // Release the current stream first. The `'prompt'` state below used to do it, but that setter is debounced and a
    // quick `'granted'` supersedes it, which left the previous camera running after a device switch.
    this._stopCapture();
    const constraints = cameraConstraints({
      cameraId: this._selectedCameraId,
      microphoneId: this._selectedMicrophoneId,
      audio: this._config.get('enableAudioRecording'),
    });
    try {
      this._setPermissionsState('prompt');
      const stream = await this._camera.open(constraints, (work, dispose) => this.whileAdopted(work, dispose));
      stream.addEventListener('inactive', () => {
        this._setPermissionsState('denied');
      });
      // The new stream's microphone starts on.
      this._audioMuted = false;
      this._setPermissionsState('granted');
    } catch (error) {
      if (isAbortError(error)) throw error;
      this._setPermissionsState('denied');
      this._log.warn('Failed to capture camera', error);
      this._telemetry.sendEventError(error, 'camera capturing. Failed to capture camera');
    }
  }

  private _applyDevices(cameras: DeviceOption[], microphones: DeviceOption[]): void {
    this._cameras = cameras;
    this._selectedCameraId = keepListedDeviceId(cameras, this._selectedCameraId);
    this._microphones = microphones;
    this._selectedMicrophoneId = keepListedDeviceId(microphones, this._selectedMicrophoneId);
  }

  protected override controllerReady(): void {
    this.runTask(async () => {
      // Without the Permissions API, ask for the camera straight away.
      if (!(await this._devices.watchPermissions())) {
        this.runTask(() => this._capture());
      }
      await this._devices.requestAccess();
      await this._capture();
      this._selectDefaultTab(parseCameraModes(this._config.get('cameraModes')));
    });
  }

  // Camera activation is adoption-scoped (it runs in `controllerReady`), so release the stream and the
  // device/permission listeners here — on disconnect and on ctx release/re-adoption alike.
  protected override controllerReleased(): void {
    // Safari and Firefox don't fire the stream's `inactive` event yet.
    const isChromium = Boolean((window as Window & { chrome?: unknown }).chrome);
    if (!isChromium) {
      this._setPermissionsState('denied');
    }
    this._stopCapture();
    this._devices.stopWatchingPermissions();
    this._camera.release();
  }

  // Picks the default tab when `cameraModes` changes. `beforeUpdate` fires it eagerly and synchronously on adoption,
  // before `controllerReady`'s awaited work runs, then again on change. What the modes show and hide is read in render.
  /** @internal */
  @effect({ beforeUpdate: true })
  protected _syncCameraModes(): void {
    if (!this.isConnected) return;
    this._selectDefaultTab(parseCameraModes(this._config.getTracked('cameraModes')));
  }

  public override firstUpdated(changedProperties: PropertyValues<this>): void {
    super.firstUpdated(changedProperties);
    this._camera.sync();
  }

  public override updated(changedProperties: PropertyValues<this>): void {
    super.updated(changedProperties);
    this._camera.sync();
  }

  private readonly _handleAction = (event: CameraActionEvent): void => {
    const { action } = event;
    switch (action.type) {
      case 'back':
        this._router.traverse('onBack');
        break;
      case 'close':
        this._router.traverse('onClose');
        break;
      case 'select-camera':
        this._selectedCameraId = action.deviceId;
        this.runTask(() => this._capture());
        break;
      case 'select-microphone':
        this._selectedMicrophoneId = action.deviceId;
        this.runTask(() => this._capture());
        break;
      case 'request-access':
        this.runTask(() => this._capture());
        break;
      case 'video-frame':
        this._hasVideoFrame = action.ready;
        break;
      case 'select-tab':
        this._selectTab(action.tab);
        break;
      case 'shutter':
        this._handleShutter();
        break;
      case 'retake':
        this._handleRetake();
        break;
      case 'accept':
        this._handleAccept();
        break;
      case 'toggle-microphone':
        this._handleToggleMicrophone();
        break;
      case 'toggle-playback':
        this._handleToggleClipPlayback();
        break;
    }
  };

  public override render() {
    const audioEnabled = this._config.getTracked('enableAudioRecording');
    const view = deriveCameraView({
      permission: this._permission,
      phase: this._phase,
      tab: this._activeTab,
      cameraModes: parseCameraModes(this._config.getTracked('cameraModes')),
      audioEnabled,
      cameraCount: this._cameras.length,
      microphoneCount: audioEnabled ? this._microphones.length : 0,
      muted: this._audioMuted,
    });
    return html`
      <uc-camera-header
        .pickCamera=${!view.cameraSelectHidden}
        .cameras=${this._cameras}
        .selectedCameraId=${this._selectedCameraId}
        @uc-internal:camera-action=${this._handleAction}
      ></uc-camera-header>
      <uc-camera-preview
        .view=${view}
        .mirror=${this._config.getTracked('cameraMirror')}
        .requestButtonHidden=${this._requestButtonHidden}
        @uc-internal:camera-action=${this._handleAction}
        ${ref(this._previewRef)}
      ></uc-camera-preview>
      <uc-camera-controls
        .view=${view}
        .activeTab=${this._activeTab}
        .microphones=${this._microphones}
        .selectedMicrophoneId=${this._selectedMicrophoneId}
        .hasVideoFrame=${this._hasVideoFrame}
        .timelineIcon=${this._timelineIcon}
        @uc-internal:camera-action=${this._handleAction}
        ${ref(this._controlsRef)}
      ></uc-camera-controls>
    `;
  }

  /** Registers the camera's parts with it, so a page that defines `<uc-camera-source>` gets the whole camera. */
  public static override reg(tagName: string): void {
    super.reg(tagName);
    CameraHeader.reg('uc-camera-header');
    CameraPreview.reg('uc-camera-preview');
    CameraControls.reg('uc-camera-controls');
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-camera-source': CameraSource;
  }
}
