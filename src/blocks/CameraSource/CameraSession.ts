import { type BuildConstraintsInput, buildConstraints } from '../../abstract/camera/buildConstraints';
import { maxShortSideOf } from '../../abstract/camera/cameraSettings';
import { type CameraMode, CameraSourceTypes } from '../../abstract/cameraModes';
import type { NavigationEdge } from '../../abstract/controllers/RouterController';
import { isAbortError } from '../../abstract/di/Lifetime';
import { signalState } from '../../abstract/di/signalState';
import type { CameraConstraints, CameraConstraintsResolver } from '../../types/exported';
import {
  CameraAccess,
  type CameraFailure,
  type CameraPermission,
  cameraFailureOf,
  type SettledPermission,
} from './CameraAccess';
import { CameraDevices } from './CameraDevices';
import { type CameraSetting, CaptureSettings } from './CaptureSettings';
import type { CameraLifetime, CameraReport } from './cameraHost';
import { CameraFeed } from './media/CameraFeed';
import { ClipReview } from './media/ClipReview';
import { MicrophoneSwap } from './media/MicrophoneSwap';
import { PhotoCapture, photoFile } from './media/PhotoCapture';
import { type ClipHandlers, PreviewVideo } from './media/PreviewVideo';
import { type ClockView, RecordingClock } from './media/RecordingClock';
import { recorderOptions, VideoRecording } from './media/VideoRecording';
import { RequestedConstraints } from './RequestedConstraints';

/** Where the capture stands: the live preview, a photo taken, a clip being recorded, or a clip recorded. */
export type CameraPhase = 'live' | 'shot' | 'recording' | 'recorded';

/** What the user did in one of the camera's parts; the session decides what it means. */
export type CameraCommand =
  | { type: 'back' }
  | { type: 'close' }
  | { type: 'select-camera'; deviceId: string }
  | { type: 'select-microphone'; deviceId: string }
  | { type: 'request-access' }
  | { type: 'pick-setting'; setting: CameraSetting; value: string }
  | { type: 'select-tab'; tab: CameraMode }
  | { type: 'shutter' }
  | { type: 'retake' }
  | { type: 'accept' }
  | { type: 'toggle-microphone' }
  | { type: 'toggle-playback' };

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
  navigate: (edge: NavigationEdge) => void;
  /** Adds a captured photo or clip to the upload list. */
  addFile: (file: File) => void;
  /** Reports a user action to telemetry. */
  track: (event: string, extra: Record<string, unknown>) => void;
  report: CameraReport;
};

/**
 * One camera's state and everything it does: asks for access, opens the stream, lists the devices, takes photos,
 * records clips, and reacts to what the user does in the camera's parts. The fields are signals, so the element that
 * renders them re-renders on every change.
 */
export class CameraSession {
  @signalState() public phase: CameraPhase = 'live';
  @signalState() public activeTab: CameraMode | null = null;

  private readonly _photo = new PhotoCapture();
  private readonly _recording = new VideoRecording();
  private readonly _review = new ClipReview();
  private readonly _clock = new RecordingClock();
  /** The recording timer and the clip's timeline, for the controls to render. */
  public readonly clock: ClockView = this._clock;
  private readonly _preview: PreviewVideo;
  private readonly _clipHandlers: ClipHandlers = {
    onPlay: () => {
      this._clock.startTimeline(() => this._preview.sample());
      this._review.playing(true);
    },
    onPause: () => {
      this._review.playing(false);
      this._clock.stop();
    },
  };
  /** The camera's media stream and its tracks. */
  public readonly feed: CameraFeed;
  private readonly _microphone: MicrophoneSwap;
  public readonly settings: CaptureSettings;
  public readonly devices: CameraDevices;
  private readonly _access: CameraAccess;
  private readonly _requested = new RequestedConstraints();

  /** Runs once a permission state settled and shows. */
  private _permissionSettled(state: SettledPermission): void {
    if (state === 'prompt') {
      this._stopCapture();
      return;
    }
    // A new stream, or none: whatever was captured from the previous one is gone.
    this.phase = 'live';
    if (state === 'denied') {
      this._stopCapture();
    }
    this._captureResolved();
  }

  public constructor(private readonly _host: CameraSessionHost) {
    this._preview = new PreviewVideo(_host.lifetime.runTask);
    this.feed = new CameraFeed(_host.lifetime, _host.report);
    this._microphone = new MicrophoneSwap(_host.lifetime, _host.report);
    this.settings = new CaptureSettings(_host.config);
    this.devices = new CameraDevices({
      lifetime: _host.lifetime,
      audioEnabled: () => _host.config.audioEnabled(),
      cameraLabel: _host.cameraLabel,
      onDevicesChange: (lists) => {
        this.devices.adopt(lists, this.feed.stream);
        this._syncRequestedConstraints();
      },
      report: _host.report,
    });
    this._access = new CameraAccess({
      lifetime: _host.lifetime,
      onPermissionChange: (name) => this._permissionChanged(name),
      onSettled: (state) => this._permissionSettled(state),
      report: _host.report,
    });
  }

  public get permission(): CameraPermission {
    return this._access.permission;
  }

  /** Why access ended `denied`, which picks the message shown. */
  public get failure(): CameraFailure {
    return this._access.failure;
  }

  /** The recording was asked to stop and its clip is not handed over yet. */
  public get isStopping(): boolean {
    return this._recording.isStopping;
  }

  /** The recorded clip's play/pause icon. */
  public get timelineIcon(): 'play' | 'pause' {
    return this._review.timelineIcon;
  }

  /**
   * The clip under review has its mirroring baked in, so the preview must not mirror it again. Only while the preview
   * shows it: a camera reopened over it shows the live stream at once, which mirrors as configured.
   */
  public get playbackMirrored(): boolean {
    return this._preview.showingClip && this._review.mirrored;
  }

  /** The shutter waits for a frame: a shot before the first one draws an empty canvas, which accepting drops. */
  public get hasVideoFrame(): boolean {
    return this._preview.hasVideoFrame;
  }

  /** The preview rendered its `<video>`, which the stream and the clip are shown in until release. */
  public previewVideo(video: HTMLVideoElement): void {
    this._preview.attach(video);
  }

  /** The preview's `<video>` has a frame to show, or lost it. */
  public previewFrame(ready: boolean): void {
    this._preview.frame(ready);
  }

  /**
   * Watches the permissions and opens the camera on the first configured tab, asking for it once. The devices are
   * listed once it opened, when their labels are readable, and again whenever they change.
   */
  public async activate(cameraModes: CameraMode[]): Promise<void> {
    const adoption = this._host.lifetime.adoptionSignal();
    await this._access.watchPermissions();
    this.devices.watchDeviceChanges(adoption);
    await this._capture(adoption);
    this.selectDefaultTab(cameraModes);
  }

  /** Stops the camera and lets go of every listener; a pending permission state is dropped. */
  public release(): void {
    this._access.cancel();
    // A recording or a photo in progress belongs to the stream being stopped, so the phase is live again. The tab is
    // left to the next activation: the config is not read after the adoption ended.
    this._recording.discard();
    this._photo.discard();
    this.phase = 'live';
    this._requested.clearPending();
    this._stopCapture();
    this._access.stopWatchingPermissions();
    this._preview.release();
    this._review.close();
  }

  /**
   * Falls back to the first configured mode when the current tab isn't one. A capture not yet resolved keeps its tab:
   * the shutter still stops its recording, and its review keeps its actions. It falls back once the capture resolves.
   */
  public selectDefaultTab(cameraModes: CameraMode[]): void {
    if (this.phase !== 'live' || this._recording.isStopping) return;
    const defaultTab = cameraModes[0];
    if (defaultTab && (!this.activeTab || !cameraModes.includes(this.activeTab))) {
      this._selectTab(defaultTab);
    }
  }

  /**
   * The option behind `setting` changed in the config: the user's pick gives way to its first listed value, applied to
   * the open camera. A `cameraConstraints` change also forgets that the camera couldn't satisfy the previous ones.
   * `enableAudioRecording` turning on or off adds or drops the microphone, and lists the microphones again or none.
   */
  public configChanged(setting: CameraSetting | 'constraints' | 'audioEnabled'): void {
    if (setting === 'constraints') {
      this.feed.resetCustomDropped();
    } else if (setting === 'audioEnabled') {
      if (this.devices.cameras.length) this._host.lifetime.runTask(() => this.devices.list());
    } else {
      this.settings.reset(setting);
    }
    this._applyConstraints(setting);
  }

  public handle(action: CameraCommand): void {
    switch (action.type) {
      case 'back':
        this._host.navigate('onBack');
        break;
      case 'close':
        this._host.navigate('onClose');
        break;
      case 'select-camera':
        this._selectCamera(action.deviceId);
        break;
      case 'select-microphone':
        this._selectMicrophone(action.deviceId);
        break;
      case 'pick-setting':
        this._pickSetting(action.setting, action.value);
        break;
      case 'request-access':
        this._host.lifetime.runTask(() => this._capture());
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
      case 'toggle-microphone':
        this.feed.toggleAudio();
        break;
      case 'toggle-playback':
        this._toggleClipPlayback();
        break;
      default: {
        // A new action that isn't handled here fails to compile.
        const unhandled: never = action;
        throw new Error(`Unknown camera action: ${(unhandled as CameraCommand).type}`);
      }
    }
  }

  /**
   * A camera permission change opens the camera again. A microphone one with the camera open only retries the
   * microphone, through the audio path, so a capture under review stays.
   */
  private _permissionChanged(name: 'camera' | 'microphone'): void {
    const stream = this.feed.stream;
    if (name === 'camera' || !stream) {
      this._host.lifetime.runTask(() => this._capture());
      return;
    }
    // No live microphone in the stream: asking for one is a change, even with the request that was refused. A revoke
    // leaves the ended track in the stream.
    if (!stream.getAudioTracks().some((track) => track.readyState === 'live')) this._requested.noAudio();
    this._host.lifetime.runTask(() => this._applyAudioConstraints());
  }

  private _selectCamera(deviceId: string): void {
    this.devices.pickCamera(deviceId);
    this._host.lifetime.runTask(() => this._capture());
  }

  private _selectMicrophone(deviceId: string): void {
    this.devices.pickMicrophone(deviceId);
    this._host.lifetime.runTask(() => this._applyAudioConstraints());
  }

  private _pickSetting(setting: CameraSetting, value: string): void {
    this.settings.pick(setting, value);
    this._track('camera-setting-change', { tabId: this.activeTab, setting, value });
    this._applyConstraints(setting);
  }

  private _track(event: string, extra: Record<string, unknown> = { tabId: this.activeTab }): void {
    this._host.track(event, extra);
  }

  /** A capture event, with the settings it was taken with. Never the custom constraints: they can name devices. */
  private _trackCapture(event: string): void {
    this._track(event, {
      tabId: this.activeTab,
      hasCustomConstraints: Boolean(this._host.config.constraints()),
      ...this.settings.telemetry(),
    });
  }

  private _selectTab(tab: CameraMode): void {
    if (tab === CameraSourceTypes.VIDEO) {
      this._review.resetIcon();
    }
    this._track('camera-tab-switch', { tabId: tab });
    this.activeTab = tab;
    // Only the function form can differ between modes.
    if (typeof this._host.config.constraints() === 'function') {
      this._applyConstraints('constraints');
    }
  }

  /**
   * Applies what `setting` changed to the open camera: the ratio and resolution to the video track, the sound to the
   * microphone, custom constraints to both. The audio bitrate is set when a recording starts, so it needs nothing.
   */
  private _applyConstraints(setting: CameraSetting | 'constraints' | 'audioEnabled'): void {
    const { runTask } = this._host.lifetime;
    if (setting === 'aspectRatio' || setting === 'resolution' || setting === 'constraints') {
      runTask(() => this._applyVideoConstraints());
    }
    if (setting === 'audioMode' || setting === 'audioEnabled' || setting === 'constraints') {
      runTask(() => this._applyAudioConstraints());
    }
  }

  private _shutter(): void {
    // The recorder is stopping: the clip is on its way, and a new recording would start before it shows.
    if (this._recording.isStopping) return;
    // `shot-camera` takes a photo or starts a recording, `start-camera` marks a recording starting, and stopping
    // one reports `stop-camera`.
    if (!this._recording.isRecording) {
      this._trackCapture('shot-camera');
      if (this.activeTab === CameraSourceTypes.VIDEO) this._trackCapture('start-camera');
    }
    if (this.activeTab === CameraSourceTypes.PHOTO) {
      this._shot();
    } else if (this.activeTab === CameraSourceTypes.VIDEO) {
      if (this._recording.isRecording) {
        this._stopRecording();
      } else {
        this._startRecording();
      }
    }
  }

  private _shot(): void {
    this.phase = 'shot';
    const video = this._preview.element;
    if (!video) {
      throw new Error('Video element not found');
    }
    // The preview frame as the shutter is pressed, cropped, mirrored and encoded as it will be sent. A still from
    // `ImageCapture.takePhoto()` was tried on main: with a real camera the preview changed after a shot and a retake.
    this._photo.take(video, {
      aspectRatio: this.settings.aspectRatio,
      mirror: this._host.config.mirror(),
      quality: this._host.config.photoQuality(),
    });
    // TODO: There are troubles with this, image isn't freezed after shot due to rendering in progress
    this._preview.pause();
  }

  private _startRecording(): void {
    const stream = this.feed.stream;
    if (!stream) return;
    const { config } = this._host;
    try {
      this._recording.start(stream, this._preview.element, {
        aspectRatio: this.settings.aspectRatio,
        mirror: config.mirror(),
        recorder: recorderOptions(config.recorderOptions(), this.settings.audioQuality, config.videoFormats()),
      });
      this._clock.startTimer(config.maxRecordingSeconds, () => this._stopRecording());
      this.phase = 'recording';
    } catch (error) {
      this._host.report('error', 'Failed to start recording', error, 'camera recording. Failed to start recording');
    }
  }

  private _stopRecording(): void {
    // The time limit and the shutter can both ask; only the first stops it.
    if (!this._recording.isRecording) return;
    this._track('stop-camera');
    this._host.lifetime.runTask(() => this._showRecording());
  }

  /**
   * Once the recorder handed over the clip: shows it for review, then applies what changed while recording. A clip
   * recorded from a stream that was replaced meanwhile is dropped: the preview shows the new one live.
   */
  private async _showRecording(): Promise<void> {
    const stream = this.feed.stream;
    const clip = await this._host.lifetime.whileAdopted(this._recording.stop());
    if (!clip) return;
    if (this.feed.stream !== stream) {
      this._recording.discard();
      this._captureResolved();
      return;
    }
    try {
      this._preview.showClip(this._review.show(clip), this._clipHandlers);
    } catch (error) {
      this._host.report('error', 'Failed to preview video', error, 'camera previewing. Failed to preview video');
    }
    this._clock.stop();
    if (this.activeTab === CameraSourceTypes.VIDEO) this.phase = 'recorded';
    const pending = this._requested.flush();
    if (pending.video) this._host.lifetime.runTask(() => this._applyVideoConstraints());
    if (pending.audio) this._host.lifetime.runTask(() => this._applyAudioConstraints());
  }

  /** Pauses or resumes the recorded clip's preview. */
  private _toggleClipPlayback(): void {
    if (this._recording.isRecording) return;
    this._preview.togglePlayback();
  }

  private _retake(): void {
    this._track('retake-camera');
    this.phase = 'live';
    this._photo.discard();
    if (this.activeTab === CameraSourceTypes.VIDEO) {
      this._clock.stop();
      // The encoded clip stays in the recorder's chunks until dropped.
      this._recording.discard();
      this._review.close();
      this._preview.showLive(this.feed.stream);
    }
    this._preview.play();
    this._captureResolved();
  }

  private _accept(): void {
    this._track('accept-camera');
    this.phase = 'live';
    if (this.activeTab === CameraSourceTypes.PHOTO) {
      const photo = this._photo.claim();
      if (photo) this._host.lifetime.runTask(() => this._addPhoto(photo));
    } else {
      const clip = this._review.take();
      this._recording.discard();
      if (clip) this._addFile(clip);
    }
    this._captureResolved();
  }

  /** The capture was accepted, retaken or dropped: a `cameraModes` change that waited for it switches the tab now. */
  private _captureResolved(): void {
    this.selectDefaultTab(this._host.config.cameraModes());
  }

  private async _addPhoto(photo: Promise<Blob>): Promise<void> {
    try {
      const blob = await this._host.lifetime.whileAdopted(photo);
      this._addFile(photoFile(blob));
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
    // A recording can't outlive its stream: it ends with no clip. One already stopping drops its clip on arrival.
    if (this._recording.isRecording) {
      this._recording.discard();
      this.phase = 'live';
      this._captureResolved();
    }
    this._recording.releaseSource();
    if (!this.feed.stream) return;
    this._preview.close();
    this.feed.close();
    this._clock.stop();
  }

  /** The mode the camera opens for: the active tab, or the tab about to become active. */
  private _currentMode(): CameraMode {
    return this.activeTab ?? this._host.config.cameraModes()[0] ?? CameraSourceTypes.PHOTO;
  }

  /** `custom` defaults to `cameraConstraints`, unless the open camera couldn't satisfy them. */
  private _constraintsInput(
    custom = this.feed.customDropped ? null : this._host.config.constraints(),
  ): BuildConstraintsInput {
    return {
      mode: this._currentMode(),
      enableAudio: this._host.config.audioEnabled(),
      audioMode: this.settings.audioMode,
      aspectRatio: this.settings.aspectRatio,
      resolution: this.settings.resolution,
      custom,
      cameraId: this.devices.selectedCameraId,
      audioId: this.devices.selectedMicrophoneId,
    };
  }

  /**
   * Once the device list names the devices already in use, asking for them by id is the same request, not a change.
   * Without this, the first unrelated change would reopen the microphone for nothing.
   */
  private _syncRequestedConstraints(): void {
    const stream = this.feed.stream;
    if (!stream) return;
    this._requested.syncDevices(
      buildConstraints(this._constraintsInput()),
      {
        cameraId: stream.getVideoTracks()[0]?.getSettings().deviceId,
        microphoneId: stream.getAudioTracks()[0]?.getSettings().deviceId,
      },
      { cameraId: this.devices.selectedCameraId, microphoneId: this.devices.selectedMicrophoneId },
    );
  }

  /** Applies changed video constraints to the open camera. A change during a recording waits for it to stop. */
  private async _applyVideoConstraints(): Promise<void> {
    if (!this.feed.stream?.getVideoTracks()[0]) return;
    if (this._recording.isRecording) {
      this._requested.deferVideo();
      return;
    }
    const input = this._constraintsInput();
    const { video } = buildConstraints(input);
    if (!this._requested.requestVideo(video)) return;
    // Only blame `cameraConstraints` when they took part in the request.
    await this.feed.applyVideo(video, Boolean(input.custom));
  }

  /**
   * Applies changed microphone settings by swapping in a newly opened microphone, or drops it when audio recording is
   * off. One that lands during a recording would break it: the request waits for the stop instead.
   */
  private async _applyAudioConstraints(): Promise<void> {
    const stream = this.feed.stream;
    if (!stream) return;
    if (this._recording.isRecording) {
      this._requested.deferAudio();
      return;
    }
    const { audio } = buildConstraints(this._constraintsInput());
    if (!audio) {
      this._requested.noAudio();
      this.feed.dropAudio();
      return;
    }
    const request = this._requested.requestAudio(audio);
    if (!request) return;
    // Audio recording turned off while the microphone opened: its track is stale too.
    const isCurrent = () => this.feed.stream === stream && this._host.config.audioEnabled();
    const track = await this._microphone.open(audio, isCurrent);
    if (!track) return;
    // A recording began while it opened: swapping it in now would break the recording, so it waits for the stop.
    if (this._recording.isRecording) {
      track.stop();
      this._requested.deferAudio(request);
      return;
    }
    // Checked again with the swap, no await between: the stream can change in the hop since the swap resolved.
    if (!isCurrent()) {
      track.stop();
      return;
    }
    this.feed.swapAudioTrack(track);
  }

  /** `adoption` is the signal of the lifetime the calling task started in. */
  private async _capture(adoption = this._host.lifetime.adoptionSignal()): Promise<void> {
    // Release the current stream first. The prompt state below used to do it, but it is debounced and a quick
    // 'granted' supersedes it, which left the previous camera running after a device switch.
    this._stopCapture();
    try {
      this._access.settleLater('prompt');
      // The open forgets dropped custom constraints, so it is asked for the configured ones.
      const opened = await this.feed.open(this._constraintsInput(this._host.config.constraints()), () =>
        this._preview.silence(),
      );
      // A later capture took over; it settles the permission state.
      if (!opened) return;
      const { stream } = opened;
      this._preview.show(stream);
      this._requested.opened(opened.constraints);
      // Ends on a revoked permission, and also when this stream is stopped for the next one; only the first counts.
      const lost = () => {
        if (this.feed.stream === stream) this._access.settleLater('denied');
      };
      stream.addEventListener('inactive', lost);
      // The camera alone can end (unplugged, taken by the system) while the microphone keeps the stream active.
      stream.getVideoTracks()[0]?.addEventListener('ended', lost, { once: true, signal: adoption });
      this._access.settleLater('granted');
      // Another camera may not do the picked preset: start the resolution picker over if it's no longer offered.
      this.settings.cameraOpened(maxShortSideOf(stream.getVideoTracks()[0]));
      // Access is granted now, so the labels are readable: list the devices the first time.
      if (!this.devices.cameras.length) this._host.lifetime.runTask(() => this.devices.list());
      // The camera opened with what was in effect when it was asked for. Apply what is in effect now: a preset the
      // camera turned out not to do was left out of the picker, and a pick made while it opened was not applied.
      this._applyConstraints('constraints');
    } catch (error) {
      // Asks the task's lifetime, not the error: `getUserMedia` names a camera that fails to start `AbortError` too.
      // Not the current adoption either: after a move it is the next one's, still live.
      if (adoption.aborted) throw error;
      this._access.settleLater('denied', cameraFailureOf(error));
      this._host.report('warn', 'Failed to capture camera', error, 'camera capturing. Failed to capture camera');
    }
  }
}
