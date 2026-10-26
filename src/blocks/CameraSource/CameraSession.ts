import type { CameraMode } from '../../abstract/cameraModes';
import type { NavigationEdge } from '../../abstract/controllers/RouterController';
import { signalState } from '../../abstract/di/signalState';
import { debounce } from '../../utils/debounce';
import type { CameraAction } from './CameraActionEvent';
import { CameraDevices, type DeviceOption } from './CameraDevices';
import { CameraRecorder, createCameraFile, RecordingClock } from './CameraRecorder';
import { CameraStream, cameraConstraints, captureFrame } from './CameraStream';
import type { CameraPermission, CameraPhase } from './cameraView';
import { CameraSourceTypes } from './constants';

const DEFAULT_PICTURE_FORMAT = 'image/jpeg';

/** How long the permission state settles before it shows; a quick prompt→granted never flashes the prompt. */
const PERMISSION_STATE_DELAY = 300;

/** The current device stays selected while it is still listed; otherwise the first one takes over. */
const keepListedDeviceId = (devices: { value: string }[], currentId: string | null): string | null =>
  devices.some((device) => device.value === currentId) ? currentId : (devices[0]?.value ?? null);

/** What the camera element lends the session: its lifetime, config, elements, and the ways out. */
export type CameraSessionHost = {
  whileAdopted: <T>(work: PromiseLike<T>, dispose?: (value: T) => void) => Promise<T>;
  runTask: (task: () => unknown) => void;
  adoptionSignal: () => AbortSignal;
  config: {
    audioEnabled: () => boolean;
    mirror: () => boolean;
    recorderOptions: () => MediaRecorderOptions;
    maxRecordingSeconds: () => number | undefined;
  };
  cameraLabel: (index: number) => string;
  video: () => HTMLVideoElement | undefined;
  timer: () => HTMLElement | undefined;
  timeline: () => HTMLElement | undefined;
  /** Toggles a class on the camera element (`uc-initialized`, `uc-recording`). */
  setHostClass: (name: string, on: boolean) => void;
  navigate: (edge: NavigationEdge) => void;
  /** Adds a captured photo or clip to the upload list. */
  addFile: (file: File) => void;
  /** Reports a user action to telemetry. */
  track: (event: string, extra: Record<string, unknown>) => void;
  /** Reports a failure the camera recovers from: to the log at `level`, and to telemetry with `context`. */
  report: (level: 'warn' | 'error', message: string, error: unknown, context: string) => void;
};

/**
 * One camera's state and everything it does: asks for access, opens the stream, lists the devices, takes photos,
 * records clips, and reacts to what the user does in the camera's parts. The fields are signals, so the element that
 * renders them re-renders on every change.
 */
export class CameraSession {
  @signalState() public permission: CameraPermission = 'idle';
  @signalState() public phase: CameraPhase = 'live';
  @signalState() public activeTab: CameraMode | null = null;
  @signalState() public cameras: DeviceOption[] = [];
  @signalState() public microphones: DeviceOption[] = [];
  @signalState() public selectedCameraId: string | null = null;
  @signalState() public selectedMicrophoneId: string | null = null;
  @signalState() public audioMuted = false;
  /** The shutter waits for a frame: a shot before the first one draws an empty canvas, which accepting drops. */
  @signalState() public hasVideoFrame = false;
  /** The recorded clip's play/pause icon. */
  @signalState() public timelineIcon = 'play';

  private readonly _recorder = new CameraRecorder();
  private readonly _clock = new RecordingClock();
  private readonly _stream: CameraStream;
  private readonly _devices: CameraDevices;
  /** The photo just taken, until it is accepted or retaken. */
  private _photo: HTMLCanvasElement | null = null;

  private readonly _setPermission = debounce((state: Exclude<CameraPermission, 'idle'>) => {
    // A state settling after the camera was released belongs to no one.
    if (this._host.adoptionSignal().aborted) return;
    this._host.setHostClass('uc-initialized', state === 'granted');
    this.permission = state;
    if (state === 'prompt') {
      this._stopCapture();
      return;
    }
    // A new stream, or none: whatever was captured from the previous one is gone.
    this.phase = 'live';
    if (state === 'denied') {
      this._stopCapture();
    }
  }, PERMISSION_STATE_DELAY);

  public constructor(private readonly _host: CameraSessionHost) {
    this._stream = new CameraStream({
      video: _host.video,
      onClipPlay: () => {
        this._clock.startTimeline(_host.video, _host.timeline, _host.timer);
        this.timelineIcon = 'pause';
      },
      onClipPause: () => {
        this.timelineIcon = 'play';
        this._clock.stop();
      },
    });
    this._devices = new CameraDevices({
      whileAdopted: _host.whileAdopted,
      runTask: _host.runTask,
      adoptionSignal: _host.adoptionSignal,
      audioEnabled: _host.config.audioEnabled,
      cameraLabel: _host.cameraLabel,
      onPermissionChange: () => _host.runTask(() => this._capture()),
      onDevicesChange: ({ cameras, microphones }) => {
        this.cameras = cameras;
        this.selectedCameraId = keepListedDeviceId(cameras, this.selectedCameraId);
        this.microphones = microphones;
        this.selectedMicrophoneId = keepListedDeviceId(microphones, this.selectedMicrophoneId);
      },
      onError: (error, context, message) => _host.report('warn', message, error, context),
    });
  }

  /** Watches the permissions, lists the devices and opens the camera on the first configured tab. */
  public async activate(cameraModes: CameraMode[]): Promise<void> {
    // Without the Permissions API, ask for the camera straight away.
    if (!(await this._devices.watchPermissions())) {
      this._host.runTask(() => this._capture());
    }
    await this._devices.requestAccess();
    await this._capture();
    this.selectDefaultTab(cameraModes);
  }

  /** Stops the camera and lets go of every listener; a pending permission state is dropped. */
  public release(): void {
    // Safari and Firefox don't fire the stream's `inactive` event yet.
    const isChromium = Boolean((window as Window & { chrome?: unknown }).chrome);
    if (!isChromium) {
      this._setPermission('denied');
    }
    this._setPermission.cancel();
    this._stopCapture();
    this._devices.stopWatchingPermissions();
    this._stream.release();
  }

  /** Re-applies the stream to the video element, which a render may have replaced. */
  public syncVideo(): void {
    this._stream.sync();
  }

  /** Falls back to the first configured mode when the current tab isn't one. */
  public selectDefaultTab(cameraModes: CameraMode[]): void {
    const defaultTab = cameraModes[0];
    if (defaultTab && (!this.activeTab || !cameraModes.includes(this.activeTab))) {
      this._selectTab(defaultTab);
    }
  }

  public handle(action: CameraAction): void {
    switch (action.type) {
      case 'back':
        this._host.navigate('onBack');
        break;
      case 'close':
        this._host.navigate('onClose');
        break;
      case 'select-camera':
        this.selectedCameraId = action.deviceId;
        this._host.runTask(() => this._capture());
        break;
      case 'select-microphone':
        this.selectedMicrophoneId = action.deviceId;
        this._host.runTask(() => this._capture());
        break;
      case 'request-access':
        this._host.runTask(() => this._capture());
        break;
      case 'video-frame':
        this.hasVideoFrame = action.ready;
        break;
      case 'select-tab':
        this._selectTab(action.tab);
        break;
      case 'shutter':
        this._shutter();
        break;
      case 'retake':
        this._retake();
        break;
      case 'accept':
        this._accept();
        break;
      case 'toggle-microphone': {
        const muted = this._stream.toggleAudio();
        if (muted !== undefined) this.audioMuted = muted;
        break;
      }
      case 'toggle-playback':
        this._toggleClipPlayback();
        break;
    }
  }

  private _track(event: string, extra: Record<string, unknown> = { tabId: this.activeTab }): void {
    this._host.track(event, extra);
  }

  private _selectTab(tab: CameraMode): void {
    if (tab === CameraSourceTypes.VIDEO) {
      this.timelineIcon = 'play';
    }
    this._track('camera-tab-switch', { tabId: tab });
    this.activeTab = tab;
  }

  private _shutter(): void {
    this._track('shot-camera');
    this._track('start-camera');
    if (this.activeTab === CameraSourceTypes.PHOTO) {
      this._shot();
    } else if (this.activeTab === CameraSourceTypes.VIDEO) {
      if (this._recorder.isRecording) {
        this._stopRecording();
      } else {
        this._startRecording();
      }
    }
  }

  private _shot(): void {
    if (this.activeTab === CameraSourceTypes.PHOTO) this.phase = 'shot';
    const video = this._host.video();
    if (!video) {
      throw new Error('Video element not found');
    }
    this._photo = captureFrame(video, this._host.config.mirror());
    // TODO: There are troubles with this, image isn't freezed after shot due to rendering in progress
    video.pause();
  }

  private _startRecording(): void {
    try {
      const stream = this._stream.stream;
      if (!stream) return;
      this._recorder.start(stream, this._host.config.recorderOptions());
      this._clock.startTimer(this._host.timer, this._host.config.maxRecordingSeconds, () => this._stopRecording());
      this._host.setHostClass('uc-recording', true);
      this.phase = 'recording';
    } catch (error) {
      this._host.report('error', 'Failed to start recording', error, 'camera recording. Failed to start recording');
    }
  }

  private _stopRecording(): void {
    this._recorder.stop(() => {
      try {
        this._stream.showClip(this._recorder.clip());
      } catch (error) {
        this._host.report('error', 'Failed to preview video', error, 'camera previewing. Failed to preview video');
      }
      this._clock.stop();
      if (this.activeTab === CameraSourceTypes.VIDEO) this.phase = 'recorded';
    });
    this._host.setHostClass('uc-recording', false);
    this._track('stop-camera');
  }

  /** Pauses or resumes the recorded clip's preview. */
  private _toggleClipPlayback(): void {
    if (this._recorder.isRecording) return;
    const video = this._host.video();
    if (!video) return;
    if (!video.paused && !video.ended && video.readyState > 2) {
      video.pause();
    } else if (video.paused) {
      this._host.runTask(() => video.play());
    }
  }

  private _retake(): void {
    this._track('retake-camera');
    this.phase = 'live';
    if (this.activeTab === CameraSourceTypes.VIDEO) {
      this._clock.stop();
      this._stream.showLive();
    }
    const video = this._host.video();
    if (video) {
      this._host.runTask(() => video.play());
    }
  }

  private _accept(): void {
    this._track('accept-camera');
    this.phase = 'live';
    if (this.activeTab === CameraSourceTypes.PHOTO) {
      this._photo?.toBlob((blob) => {
        if (blob) this._addFile(createCameraFile('camera', 'jpeg', DEFAULT_PICTURE_FORMAT, blob));
      }, DEFAULT_PICTURE_FORMAT);
      return;
    }
    this._addFile(this._recorder.takeFile());
  }

  private _addFile(file: File): void {
    this._host.addFile(file);
    this._host.navigate('onFileAdd');
  }

  private _stopCapture(): void {
    if (this._stream.close()) {
      this._clock.stop();
    }
  }

  private async _capture(): Promise<void> {
    // Release the current stream first. The prompt state below used to do it, but it is debounced and a quick
    // 'granted' supersedes it, which left the previous camera running after a device switch.
    this._stopCapture();
    const constraints = cameraConstraints({
      cameraId: this.selectedCameraId,
      microphoneId: this.selectedMicrophoneId,
      audio: this._host.config.audioEnabled(),
    });
    try {
      this._setPermission('prompt');
      const stream = await this._stream.open(constraints, this._host.whileAdopted);
      // A later capture took over; it settles the permission state.
      if (!stream) return;
      // Ends on a revoked permission, and also when this stream is stopped for the next one; only the first counts.
      stream.addEventListener('inactive', () => {
        if (this._stream.stream === stream) this._setPermission('denied');
      });
      // The new stream's microphone starts on.
      this.audioMuted = false;
      this._setPermission('granted');
    } catch (error) {
      // Asks the lifetime, not the error: `getUserMedia` names a camera that fails to start `AbortError` too.
      if (this._host.adoptionSignal().aborted) throw error;
      this._setPermission('denied');
      this._host.report('warn', 'Failed to capture camera', error, 'camera capturing. Failed to capture camera');
    }
  }
}
