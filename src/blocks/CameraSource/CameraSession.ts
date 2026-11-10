import {
  audioBitsPerSecond,
  type BuildConstraintsInput,
  buildConstraints,
  sameExceptDevice,
} from '../../abstract/camera/buildConstraints';
import {
  AUDIO_MODES,
  AUDIO_QUALITIES,
  filterResolutionOptions,
  maxShortSideOf,
  NATIVE_ASPECT_RATIO,
  parseAspectRatioOptions,
  parseOptions,
  RESOLUTIONS,
  toRatio,
} from '../../abstract/camera/cameraSettings';
import { pickVideoMimeType } from '../../abstract/camera/videoFormat';
import { type CameraMode, CameraSourceTypes } from '../../abstract/cameraModes';
import type { NavigationEdge } from '../../abstract/controllers/RouterController';
import { isAbortError } from '../../abstract/di/Lifetime';
import { signalState } from '../../abstract/di/signalState';
import type {
  CameraAudioMode,
  CameraAudioQuality,
  CameraConstraints,
  CameraConstraintsResolver,
  CameraResolution,
} from '../../types/exported';
import { debounce } from '../../utils/debounce';
import type { CameraAction, CameraSetting } from './CameraActionEvent';
import { CameraDevices, type CameraLifetime, type DeviceOption } from './CameraDevices';
import { CameraRecorder, createCameraFile, RecordingClock } from './CameraRecorder';
import { CameraStream, stopTracks } from './CameraStream';
import { type CameraFailure, type CameraPermission, type CameraPhase, cameraFailureOf } from './cameraView';
import { renderPhoto } from './photoCapture';
import { createRecordingSource, type RecordingSource } from './recordingSource';

const DEFAULT_PICTURE_FORMAT = 'image/jpeg';

/** How long the permission state settles before it shows; a quick prompt→granted never flashes the prompt. */
const PERMISSION_STATE_DELAY = 300;

/**
 * The device to show as selected: the current choice while it is still listed, otherwise the one the open stream
 * actually uses, otherwise the first.
 */
const resolveSelectedId = (
  devices: { value: string }[],
  currentId: string | null,
  track: MediaStreamTrack | undefined,
): string | null => {
  const listed = (id: string | null | undefined) => !!id && devices.some((device) => device.value === id);
  if (listed(currentId)) return currentId;
  const activeId = track?.getSettings().deviceId;
  if (listed(activeId)) return activeId ?? null;
  return devices[0]?.value ?? null;
};

const isOverconstrained = (error: unknown): boolean => (error as Error | null)?.name === 'OverconstrainedError';

/** What the camera element lends the session: its lifetime, config, elements, and the ways out. */
export type CameraSessionHost = {
  lifetime: CameraLifetime;
  config: {
    audioEnabled: () => boolean;
    mirror: () => boolean;
    recorderOptions: () => MediaRecorderOptions | null;
    maxRecordingSeconds: () => number | undefined;
    cameraModes: () => CameraMode[];
    videoFormats: () => string;
    constraints: () => CameraConstraints | CameraConstraintsResolver | null;
    aspectRatio: () => string;
    resolution: () => string;
    photoQuality: () => number;
    audioQuality: () => string;
    audioMode: () => string;
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
  /** Why access ended `denied`, which picks the message shown. */
  @signalState() public failure: CameraFailure = 'denied';
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
  /** The clip under review has its mirroring baked in, so the preview must not mirror it again. */
  @signalState() public playbackMirrored = false;
  /** The largest short side the open camera reports, to leave out resolutions it can't do. */
  @signalState() public maxShortSide: number | null = null;
  /** The camera's own shape as the preview shows it, which the native ratio's icon draws. */
  @signalState() public previewShape: { width: number; height: number } | null = null;

  /**
   * The user's picks in the settings, as option values. `null` until the user picks, in which case the first listed
   * value applies; a config change clears them again. They never write back to the config.
   */
  @signalState() private _pickedAspectRatio: string | null = null;
  @signalState() private _pickedResolution: CameraResolution | null = null;
  @signalState() private _pickedAudioQuality: CameraAudioQuality | null = null;
  @signalState() private _pickedAudioMode: CameraAudioMode | null = null;

  private readonly _recorder = new CameraRecorder();
  private readonly _clock = new RecordingClock();
  private readonly _stream: CameraStream;
  private readonly _devices: CameraDevices;
  /** The photo under review, as the JPEG it will be sent as. A retake drops it. */
  private _photo: Promise<Blob> | null = null;
  /** What the recorder records: the camera stream, or a canvas that crops and mirrors it like a photo. */
  private _recordingSource: RecordingSource | null = null;
  /**
   * Set when the camera opened without `cameraConstraints` because it couldn't satisfy them. Later changes are applied
   * without them too, until the option changes or the camera opens again.
   */
  private _customConstraintsDropped = false;
  /** The constraints last asked of the open camera and microphone, serialized to compare against the next request. */
  private _requestedVideo: string | null = null;
  private _requestedAudio: string | null = null;
  /** Set when the constraints changed during a recording; they are applied once it stops. */
  private _videoPending = false;
  private _audioPending = false;
  /** Counts the microphone swaps, so a slower, older one can tell it was superseded. */
  private _audioSwaps = 0;

  private readonly _setPermission = debounce(
    (state: Exclude<CameraPermission, 'idle'>, failure: CameraFailure = 'denied') => {
      // A state settling after the camera was released belongs to no one.
      if (this._host.lifetime.adoptionSignal().aborted) return;
      this._host.setHostClass('uc-initialized', state === 'granted');
      this.failure = failure;
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
    },
    PERMISSION_STATE_DELAY,
  );

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
      lifetime: _host.lifetime,
      audioEnabled: _host.config.audioEnabled,
      cameraLabel: _host.cameraLabel,
      onPermissionChange: () => _host.lifetime.runTask(() => this._capture()),
      onDevicesChange: ({ cameras, microphones }) => {
        const stream = this._stream.stream;
        this.cameras = cameras;
        this.selectedCameraId = resolveSelectedId(cameras, this.selectedCameraId, stream?.getVideoTracks()[0]);
        this.microphones = microphones;
        this.selectedMicrophoneId = resolveSelectedId(
          microphones,
          this.selectedMicrophoneId,
          stream?.getAudioTracks()[0],
        );
        this._syncRequestedConstraints();
      },
      report: (message, error, context) => _host.report('warn', message, error, context),
    });
  }

  /**
   * Watches the permissions and opens the camera on the first configured tab, asking for it once. The devices are
   * listed once it opened, when their labels are readable, and again whenever they change.
   */
  public async activate(cameraModes: CameraMode[]): Promise<void> {
    const adoption = this._host.lifetime.adoptionSignal();
    await this._devices.watchPermissions();
    this._devices.watchDeviceChanges(adoption);
    await this._capture(adoption);
    this.selectDefaultTab(cameraModes);
  }

  /** Stops the camera and lets go of every listener; a pending permission state is dropped. */
  public release(): void {
    this._setPermission.cancel();
    // A recording or a photo in progress belongs to the stream being stopped.
    this._recorder.discard();
    this._photo = null;
    this._videoPending = false;
    this._audioPending = false;
    this._stopCapture();
    this._devices.stopWatchingPermissions();
    this._stream.release();
  }

  /** Falls back to the first configured mode when the current tab isn't one. */
  public selectDefaultTab(cameraModes: CameraMode[]): void {
    const defaultTab = cameraModes[0];
    if (defaultTab && (!this.activeTab || !cameraModes.includes(this.activeTab))) {
      this._selectTab(defaultTab);
    }
  }

  // Each of these options takes one value, or a list for a picker. The value in effect is the user's pick, else the
  // first listed value.

  public get aspectRatioOptions(): string[] {
    return parseAspectRatioOptions(this._host.config.aspectRatio());
  }

  /** The ratio option in effect, `native` for the camera's own shape. */
  public get aspectRatioChoice(): string {
    return this._pickedAspectRatio ?? this.aspectRatioOptions[0] ?? NATIVE_ASPECT_RATIO;
  }

  /** Width / height in effect, or `null` for the camera's native shape. */
  public get aspectRatio(): number | null {
    return toRatio(this.aspectRatioChoice) ?? null;
  }

  /** The listed resolutions the camera can do. */
  public get resolutionOptions(): CameraResolution[] {
    return filterResolutionOptions(parseOptions(this._host.config.resolution(), RESOLUTIONS), this.maxShortSide);
  }

  /** A single value is a request rather than a picker option, so it applies even above what the camera reports. */
  public get resolution(): CameraResolution {
    return (
      this._pickedResolution ??
      this.resolutionOptions[0] ??
      parseOptions(this._host.config.resolution(), RESOLUTIONS)[0] ??
      'auto'
    );
  }

  public get audioQualityOptions(): CameraAudioQuality[] {
    return parseOptions(this._host.config.audioQuality(), AUDIO_QUALITIES);
  }

  public get audioQuality(): CameraAudioQuality {
    return this._pickedAudioQuality ?? this.audioQualityOptions[0] ?? 'auto';
  }

  public get audioModeOptions(): CameraAudioMode[] {
    return parseOptions(this._host.config.audioMode(), AUDIO_MODES);
  }

  public get audioMode(): CameraAudioMode {
    return this._pickedAudioMode ?? this.audioModeOptions[0] ?? 'voice';
  }

  /**
   * The option behind `setting` changed in the config: the user's pick gives way to its first listed value, applied to
   * the open camera. A `cameraConstraints` change also forgets that the camera couldn't satisfy the previous ones.
   */
  public configChanged(setting: CameraSetting | 'constraints'): void {
    switch (setting) {
      case 'aspectRatio':
        this._pickedAspectRatio = null;
        break;
      case 'resolution':
        this._pickedResolution = null;
        break;
      case 'audioQuality':
        this._pickedAudioQuality = null;
        break;
      case 'audioMode':
        this._pickedAudioMode = null;
        break;
      case 'constraints':
        this._customConstraintsDropped = false;
        break;
    }
    this._applyConstraints(setting);
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
        this._host.lifetime.runTask(() => this._capture());
        break;
      case 'select-microphone':
        this.selectedMicrophoneId = action.deviceId;
        this._host.lifetime.runTask(() => this._applyAudioConstraints());
        break;
      case 'pick-setting':
        this._pick(action.setting, action.value);
        break;
      case 'preview-resize':
        this.previewShape = { width: action.width, height: action.height };
        break;
      case 'request-access':
        this._host.lifetime.runTask(() => this._capture());
        break;
      case 'video-element':
        this._stream.sync();
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
      default: {
        // A new action that isn't handled here fails to compile.
        const unhandled: never = action;
        throw new Error(`Unknown camera action: ${(unhandled as CameraAction).type}`);
      }
    }
  }

  private _track(event: string, extra: Record<string, unknown> = { tabId: this.activeTab }): void {
    this._host.track(event, extra);
  }

  /** A capture event, with the settings it was taken with. Never the custom constraints: they can name devices. */
  private _trackCapture(event: string): void {
    this._track(event, {
      tabId: this.activeTab,
      hasCustomConstraints: Boolean(this._host.config.constraints()),
      // `''` for the native shape.
      aspectRatio: this.aspectRatioChoice === NATIVE_ASPECT_RATIO ? '' : this.aspectRatioChoice,
      resolution: this.resolution,
      audioQuality: this.audioQuality,
      audioMode: this.audioMode,
    });
  }

  private _selectTab(tab: CameraMode): void {
    if (tab === CameraSourceTypes.VIDEO) {
      this.timelineIcon = 'play';
    }
    this._track('camera-tab-switch', { tabId: tab });
    this.activeTab = tab;
    // Only the function form can differ between modes.
    if (typeof this._host.config.constraints() === 'function') {
      this._applyConstraints('constraints');
    }
  }

  private _pick(setting: CameraSetting, value: string): void {
    switch (setting) {
      case 'aspectRatio':
        this._pickedAspectRatio = value;
        break;
      case 'resolution':
        this._pickedResolution = value as CameraResolution;
        break;
      case 'audioQuality':
        this._pickedAudioQuality = value as CameraAudioQuality;
        break;
      case 'audioMode':
        this._pickedAudioMode = value as CameraAudioMode;
        break;
    }
    this._track('camera-setting-change', { tabId: this.activeTab, setting, value });
    this._applyConstraints(setting);
  }

  /**
   * Applies what `setting` changed to the open camera: the ratio and resolution to the video track, the sound to the
   * microphone, custom constraints to both. The audio bitrate is set when a recording starts, so it needs nothing.
   */
  private _applyConstraints(setting: CameraSetting | 'constraints'): void {
    const { runTask } = this._host.lifetime;
    if (setting === 'aspectRatio' || setting === 'resolution' || setting === 'constraints') {
      runTask(() => this._applyVideoConstraints());
    }
    if (setting === 'audioMode' || setting === 'constraints') {
      runTask(() => this._applyAudioConstraints());
    }
  }

  private _shutter(): void {
    // `shot-camera` takes a photo or starts a recording, `start-camera` marks a recording starting, and stopping
    // one reports `stop-camera`.
    if (!this._recorder.isRecording) {
      this._trackCapture('shot-camera');
      if (this.activeTab === CameraSourceTypes.VIDEO) this._trackCapture('start-camera');
    }
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
    // The preview frame as the shutter is pressed, cropped, mirrored and encoded as it will be sent. A still from
    // `ImageCapture.takePhoto()` was tried on main: with a real camera the preview changed after a shot and a retake.
    this._photo = renderPhoto(video, {
      width: video.videoWidth,
      height: video.videoHeight,
      aspectRatio: this.aspectRatio,
      mirror: this._host.config.mirror(),
      quality: this._host.config.photoQuality(),
    });
    // TODO: There are troubles with this, image isn't freezed after shot due to rendering in progress
    video.pause();
  }

  /** The recorder's options: the configured ones, with the audio bitrate and a format the browser can record. */
  private _recorderOptions(): MediaRecorderOptions {
    const configured = this._host.config.recorderOptions();
    const options: MediaRecorderOptions = { ...configured };
    const audioBits = audioBitsPerSecond(configured, this.audioQuality);
    if (audioBits !== undefined) options.audioBitsPerSecond = audioBits;
    const mimeType = pickVideoMimeType({
      explicit: configured?.mimeType,
      formats: this._host.config.videoFormats(),
      isSupported: (type) => MediaRecorder.isTypeSupported(type),
    });
    if (mimeType) {
      options.mimeType = mimeType;
    } else {
      // An unsupported type would make the recorder throw: let the browser choose instead.
      delete options.mimeType;
    }
    return options;
  }

  private _startRecording(): void {
    try {
      const stream = this._stream.stream;
      if (!stream) return;
      const video = this._host.video();
      this._recordingSource = video
        ? createRecordingSource({ video, stream, aspectRatio: this.aspectRatio, mirror: this._host.config.mirror() })
        : null;
      this._recorder.start(this._recordingSource?.stream ?? stream, this._recorderOptions());
      this._clock.startTimer(this._host.timer, this._host.config.maxRecordingSeconds, () => this._stopRecording());
      this._host.setHostClass('uc-recording', true);
      this.phase = 'recording';
    } catch (error) {
      // The canvas would otherwise keep drawing until the camera closes.
      this._stopRecordingSource();
      this._host.report('error', 'Failed to start recording', error, 'camera recording. Failed to start recording');
    }
  }

  private _stopRecordingSource(): void {
    this.playbackMirrored = this._recordingSource?.mirrored ?? false;
    this._recordingSource?.stop();
    this._recordingSource = null;
  }

  private _stopRecording(): void {
    this._recorder.stop(() => {
      // Before the preview switches to the clip, or the canvas would start drawing the playback.
      this._stopRecordingSource();
      try {
        this._stream.showClip(this._recorder.clip());
      } catch (error) {
        this._host.report('error', 'Failed to preview video', error, 'camera previewing. Failed to preview video');
      }
      this._clock.stop();
      if (this.activeTab === CameraSourceTypes.VIDEO) this.phase = 'recorded';
      if (this._videoPending) this._host.lifetime.runTask(() => this._applyVideoConstraints());
      if (this._audioPending) this._host.lifetime.runTask(() => this._applyAudioConstraints());
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
      this._play(video);
    }
  }

  private _play(video: HTMLVideoElement): void {
    this._host.lifetime.runTask(() =>
      video.play().catch((error: unknown) => {
        // A pause or a new source interrupts a pending play(): superseded, not a failure.
        if (!isAbortError(error)) throw error;
      }),
    );
  }

  private _retake(): void {
    this._track('retake-camera');
    this.phase = 'live';
    this._photo = null;
    this.playbackMirrored = false;
    if (this.activeTab === CameraSourceTypes.VIDEO) {
      this._clock.stop();
      this._stream.showLive();
    }
    const video = this._host.video();
    if (video) {
      this._play(video);
    }
  }

  private _accept(): void {
    this._track('accept-camera');
    this.phase = 'live';
    this.playbackMirrored = false;
    if (this.activeTab === CameraSourceTypes.PHOTO) {
      const photo = this._photo;
      this._photo = null;
      if (photo) this._host.lifetime.runTask(() => this._addPhoto(photo));
      return;
    }
    this._addFile(this._recorder.takeFile());
  }

  private async _addPhoto(photo: Promise<Blob>): Promise<void> {
    try {
      const blob = await this._host.lifetime.whileAdopted(photo);
      this._addFile(createCameraFile('camera', 'jpeg', DEFAULT_PICTURE_FORMAT, blob));
    } catch (error) {
      if (isAbortError(error)) throw error;
      this._host.report('error', 'Failed to create the photo', error, 'camera capturing. Failed to create the photo');
    }
  }

  private _addFile(file: File): void {
    this._host.addFile(file);
    this._host.navigate('onFileAdd');
  }

  private _stopCapture(): void {
    this._stopRecordingSource();
    if (this._stream.close()) {
      this._clock.stop();
    }
  }

  /** The mode the camera opens for: the active tab, or the tab about to become active. */
  private _currentMode(): CameraMode {
    return this.activeTab ?? this._host.config.cameraModes()[0] ?? CameraSourceTypes.PHOTO;
  }

  private _constraintsInput(): BuildConstraintsInput {
    return {
      mode: this._currentMode(),
      enableAudio: this._host.config.audioEnabled(),
      audioMode: this.audioMode,
      aspectRatio: this.aspectRatio,
      resolution: this.resolution,
      custom: this._customConstraintsDropped ? null : this._host.config.constraints(),
      cameraId: this.selectedCameraId,
      audioId: this.selectedMicrophoneId,
    };
  }

  /**
   * Opens the stream with the constraints in effect. If `cameraConstraints` asks for something the camera can't do,
   * opens it once more without them rather than showing the camera as denied. Resolves to null when a later open took
   * over.
   */
  private async _openStream(): Promise<MediaStream | null> {
    this._customConstraintsDropped = false;
    const input = this._constraintsInput();
    const open = async (constraints: ReturnType<typeof buildConstraints>) => {
      const stream = await this._stream.open(constraints, this._host.lifetime.whileAdopted);
      if (stream) {
        this._requestedVideo = JSON.stringify(constraints.video);
        this._requestedAudio = JSON.stringify(constraints.audio);
      }
      return stream;
    };
    try {
      return await open(buildConstraints(input));
    } catch (error) {
      if (!input.custom || !isOverconstrained(error)) throw error;
      this._host.report(
        'warn',
        'The camera cannot satisfy cameraConstraints, opening it without them',
        error,
        'camera capturing. cameraConstraints could not be satisfied',
      );
      this._customConstraintsDropped = true;
      return open(buildConstraints({ ...input, custom: null }));
    }
  }

  /**
   * Once the device list names the devices already in use, asking for them by id is the same request, not a change.
   * Without this, the first unrelated change would reopen the microphone for nothing.
   */
  private _syncRequestedConstraints(): void {
    const stream = this._stream.stream;
    if (!stream) return;
    const { video, audio } = buildConstraints(this._constraintsInput());
    const cameraInUse = stream.getVideoTracks()[0]?.getSettings().deviceId;
    if (
      this.selectedCameraId &&
      this.selectedCameraId === cameraInUse &&
      sameExceptDevice(this._requestedVideo, video)
    ) {
      this._requestedVideo = JSON.stringify(video);
    }
    const microphoneInUse = stream.getAudioTracks()[0]?.getSettings().deviceId;
    if (
      typeof audio === 'object' &&
      this.selectedMicrophoneId &&
      this.selectedMicrophoneId === microphoneInUse &&
      sameExceptDevice(this._requestedAudio, audio)
    ) {
      this._requestedAudio = JSON.stringify(audio);
    }
  }

  /**
   * Applies changed video constraints to the open camera without reopening it, so there is no new permission prompt
   * and no black frame. A change during a recording waits for it to stop.
   */
  private async _applyVideoConstraints(): Promise<void> {
    const track = this._stream.stream?.getVideoTracks()[0];
    if (!track) return;
    if (this._recorder.isRecording) {
      this._videoPending = true;
      return;
    }
    this._videoPending = false;
    const input = this._constraintsInput();
    const { video } = buildConstraints(input);
    const serialized = JSON.stringify(video);
    if (serialized === this._requestedVideo) return;
    this._requestedVideo = serialized;
    try {
      await this._host.lifetime.whileAdopted(track.applyConstraints(video));
    } catch (error) {
      if (isAbortError(error)) throw error;
      // Only blame `cameraConstraints` when they took part in the request.
      const subject = input.custom ? 'the camera settings or cameraConstraints' : 'the camera settings';
      this._host.report(
        'warn',
        `The camera cannot apply ${subject}, keeping the current ones`,
        error,
        `camera capturing. ${subject} could not be applied`,
      );
    }
  }

  /**
   * Applies changed microphone settings by opening the microphone again and swapping its track in; the camera keeps
   * running. A live track can't be changed instead: Chromium ignores processing changes on one and refuses stereo.
   * The new microphone opens before the old one stops, so a failure keeps the sound that was working.
   */
  private async _applyAudioConstraints(): Promise<void> {
    const stream = this._stream.stream;
    if (!stream || !this._host.config.audioEnabled()) return;
    if (this._recorder.isRecording) {
      this._audioPending = true;
      return;
    }
    this._audioPending = false;
    const { audio } = buildConstraints(this._constraintsInput());
    const serialized = JSON.stringify(audio);
    if (!audio || serialized === this._requestedAudio) return;
    const previousRequested = this._requestedAudio;
    this._requestedAudio = serialized;
    const swap = ++this._audioSwaps;
    const adoption = this._host.lifetime.adoptionSignal();
    let next: MediaStream;
    try {
      next = await this._host.lifetime.whileAdopted(navigator.mediaDevices.getUserMedia({ audio }), stopTracks);
    } catch (error) {
      // `getUserMedia` names a microphone that fails to start `AbortError` too, so ask the lifetime.
      if (adoption.aborted) throw error;
      this._host.report(
        'warn',
        'Failed to apply the microphone settings, keeping the current ones',
        error,
        'camera capturing. Failed to reopen the microphone',
      );
      return;
    }
    const [track] = next.getAudioTracks();
    if (swap !== this._audioSwaps || this._stream.stream !== stream || !track) {
      stopTracks(next);
      return;
    }
    // A recording started while the microphone reopened: swapping the track now would break it, so wait for the stop.
    if (this._recorder.isRecording) {
      stopTracks(next);
      this._requestedAudio = previousRequested;
      this._audioPending = true;
      return;
    }
    this._stream.swapAudioTrack(track);
  }

  /** `adoption` is the signal of the lifetime the calling task started in. */
  private async _capture(adoption = this._host.lifetime.adoptionSignal()): Promise<void> {
    // Release the current stream first. The prompt state below used to do it, but it is debounced and a quick
    // 'granted' supersedes it, which left the previous camera running after a device switch.
    this._stopCapture();
    try {
      this._setPermission('prompt');
      const stream = await this._openStream();
      // A later capture took over; it settles the permission state.
      if (!stream) return;
      // Ends on a revoked permission, and also when this stream is stopped for the next one; only the first counts.
      stream.addEventListener('inactive', () => {
        if (this._stream.stream === stream) this._setPermission('denied');
      });
      // The new stream's microphone starts on.
      this.audioMuted = false;
      this._setPermission('granted');
      // Another camera may not do the picked preset: start the resolution picker over if it's no longer offered.
      this.maxShortSide = maxShortSideOf(stream.getVideoTracks()[0]);
      if (this._pickedResolution !== null && !this.resolutionOptions.includes(this._pickedResolution)) {
        this._pickedResolution = null;
      }
      // Access is granted now, so the labels are readable: list the devices the first time.
      if (!this.cameras.length) this._host.lifetime.runTask(() => this._devices.list());
      // The camera opened with what was in effect when it was asked for. Apply what is in effect now: a preset the
      // camera turned out not to do was left out of the picker, and a pick made while it opened was not applied.
      this._applyConstraints('constraints');
    } catch (error) {
      // Asks the task's lifetime, not the error: `getUserMedia` names a camera that fails to start `AbortError` too.
      // Not the current adoption either: after a move it is the next one's, still live.
      if (adoption.aborted) throw error;
      this._setPermission('denied', cameraFailureOf(error));
      this._host.report('warn', 'Failed to capture camera', error, 'camera capturing. Failed to capture camera');
    }
  }
}
