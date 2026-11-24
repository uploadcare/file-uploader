import { cameraFailureOf } from '../../abstract/camera/cameraFailure';
import { type CameraMode, CameraSourceTypes, parseCameraModes } from '../../abstract/cameraModes';
import type { NavigationEdge } from '../../abstract/controllers/RouterController';
import { isAbortError } from '../../abstract/di/Lifetime';
import { signalState } from '../../abstract/di/signalState';
import { CameraAccess, type CameraPermission, type SettledPermission } from './CameraAccess';
import type { CameraSetting } from './CaptureSettings';
import type { CameraConfig, CameraReport, CameraTasks } from './cameraHost';
import type { CameraCommand, ClockView } from './cameraTypes';
import { Capture } from './media/Capture';
import { photoFile } from './media/PhotoCapture';
import { type ClipHandlers, PreviewVideo } from './media/PreviewVideo';
import { RecordingClock } from './media/RecordingClock';
import { recorderOptions } from './media/VideoRecording';
import { StreamSettings } from './StreamSettings';

/** What the camera element lends the session for one adoption: its lifetime, the config, and the ways out. */
export type CameraSessionHost = CameraTasks & {
  config: CameraConfig;
  cameraLabel: (index: number) => string;
  microphoneLabel: (index: number) => string;
  navigate: (edge: NavigationEdge) => void;
  /** Adds a captured photo or clip to the upload list. */
  addFile: (file: File) => void;
  /** Reports a user action to telemetry. */
  track: (event: string, extra: Record<string, unknown>) => void;
  report: CameraReport;
};

/**
 * One camera's state and what it does with a capture, for one adoption of the camera element: asks for access, opens
 * the camera, takes photos, records clips, and reacts to what the user does in the camera's parts. How the stream is
 * set up is `StreamSettings`' part. The fields are signals, so the element that renders them re-renders on every
 * change.
 */
export class CameraSession {
  @signalState() public activeTab: CameraMode | null = null;

  /** What is captured and under review; the phase and what the preview shows of it are read from here. */
  private readonly _capture = new Capture();
  /** The capture, for the camera element to render from. */
  public readonly capture: Readonly<Pick<Capture, 'phase' | 'isStopping' | 'timelineIcon' | 'playbackMirrored'>> =
    this._capture;
  private readonly _clock = new RecordingClock();
  /** The recording timer and the clip's timeline, for the controls to render. */
  public readonly clock: ClockView = this._clock;
  private readonly _preview = new PreviewVideo(this._host.runTask);
  /** The shutter waits for a frame: a shot before the first one draws an empty canvas, which accepting drops. */
  public readonly preview: Readonly<Pick<PreviewVideo, 'hasVideoFrame'>> = this._preview;
  private readonly _clipHandlers: ClipHandlers = {
    onPlay: () => {
      this._clock.startTimeline(() => this._preview.sample());
      this._capture.playing(true);
    },
    onPause: () => {
      this._capture.playing(false);
      this._clock.stop();
    },
  };
  private readonly _stream = new StreamSettings({
    ...this._host,
    // The active tab, or the tab about to become active.
    mode: () => this.activeTab ?? this._cameraModes()[0] ?? CameraSourceTypes.PHOTO,
    isRecording: () => this._capture.isRecording,
  });
  /** The camera's stream, the devices and settings picked for it, and whether it opened without a refused microphone. */
  public readonly stream: Readonly<Pick<StreamSettings, 'feed' | 'devices' | 'settings' | 'microphoneDenied'>> =
    this._stream;
  private readonly _access = new CameraAccess({
    ...this._host,
    onPermissionChange: (name) => this._permissionChanged(name),
    onSettled: (state) => this._permissionSettled(state),
  });
  /** Why access ended `denied`. */
  public readonly access: Readonly<Pick<CameraAccess, 'failure'>> = this._access;

  /** Runs once a permission state settled and shows. */
  private _permissionSettled(state: SettledPermission): void {
    // No stream, asked for or refused: whatever was captured from the lost one is gone. A grant leaves the phase
    // alone: opening the camera reset it, and a capture started on the new stream since must keep its own.
    if (state !== 'granted') this._dropCapture();
    // While the camera is asked for the tab waits, as it does for the capture.
    if (state !== 'prompt') this._captureResolved();
  }

  /**
   * `previous` is the session of the adoption before. A DOM move ends one and starts the next in the same task, and
   * must not lose what the user set up or flash the camera as not asked for: the tab, the access shown, the devices
   * and the picks carry over. Everything else starts new.
   */
  public constructor(
    private readonly _host: CameraSessionHost,
    previous: CameraSession | null,
  ) {
    if (previous) {
      this.activeTab = previous.activeTab;
      this._access.keep(previous._access);
      this._stream.keep(previous._stream);
    }
  }

  public get permission(): CameraPermission {
    return this._access.permission;
  }

  /** The preview rendered its `<video>`, which the stream and the clip are shown in. */
  public previewVideo(video: HTMLVideoElement): void {
    this._preview.attach(video);
  }

  /** The preview's `<video>` has a frame to show, or lost it. */
  public previewFrame(ready: boolean): void {
    this._preview.frame(ready);
  }

  /**
   * Follows the config, watches the permissions and opens the camera on the first configured tab, asking for it once.
   * The devices are listed once it opened, when their labels are readable, and again whenever they change.
   */
  public async activate(): Promise<void> {
    // The tab is picked now, before the camera is asked for, and again whenever the modes change.
    this._host.lifetime.signal.addEventListener(
      'abort',
      this._host.config.observe('cameraModes', () => this._captureResolved(), { immediate: true }),
      { once: true },
    );
    this._stream.watchConfig();
    await this._access.watchPermissions();
    this._stream.devices.watchDeviceChanges();
    await this._openCamera();
  }

  /**
   * The adoption is over: ends the lifetime, which stops what the session started and takes its listeners off, then
   * lets go of what was captured and stops the camera. The config is not read any more.
   */
  public end(): void {
    this._host.lifetime.end();
    this._capture.end();
    this._closeCamera();
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
        this._stream.selectMicrophone(action.deviceId);
        break;
      case 'pick-setting':
        this._pickSetting(action.setting, action.value);
        break;
      case 'request-access':
        this._host.runTask(() => this._openCamera());
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
        this._stream.feed.toggleAudio();
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
    if (name === 'camera' || !this._stream.feed.stream) {
      this._host.runTask(() => this._openCamera());
    } else {
      this._stream.retryMicrophone();
    }
  }

  private _selectCamera(deviceId: string): void {
    this._stream.devices.pickCamera(deviceId);
    this._host.runTask(() => this._openCamera());
  }

  private _pickSetting(setting: CameraSetting, value: string): void {
    this._stream.settings.pick(setting, value);
    this._track('camera-setting-change', { tabId: this.activeTab, setting, value });
    this._stream.apply(setting);
  }

  private _track(event: string, extra: Record<string, unknown> = { tabId: this.activeTab }): void {
    this._host.track(event, extra);
  }

  /** A capture event, with the settings it was taken with. Never the custom constraints: they can name devices. */
  private _trackCapture(event: string): void {
    this._track(event, {
      tabId: this.activeTab,
      hasCustomConstraints: Boolean(this._host.config.get('cameraConstraints')),
      ...this._stream.settings.telemetry(),
    });
  }

  private _selectTab(tab: CameraMode): void {
    if (tab === CameraSourceTypes.VIDEO) {
      this._capture.playing(false);
    }
    this._track('camera-tab-switch', { tabId: tab });
    this.activeTab = tab;
    // Only the function form can differ between modes.
    if (typeof this._host.config.get('cameraConstraints') === 'function') {
      this._stream.apply('constraints');
    }
  }

  private _shutter(): void {
    // The recorder is stopping: the clip is on its way, and a new recording would start before it shows.
    if (this._capture.isStopping) return;
    // A recording is what the shutter stops, whatever the tab says by now.
    if (this._capture.isRecording) {
      this._stopRecording();
      return;
    }
    // `shot-camera` takes a photo or starts a recording, `start-camera` marks a recording starting, and stopping
    // one reports `stop-camera`.
    this._trackCapture('shot-camera');
    if (this.activeTab === CameraSourceTypes.PHOTO) {
      this._shot();
    } else if (this.activeTab === CameraSourceTypes.VIDEO) {
      this._trackCapture('start-camera');
      this._startRecording();
    }
  }

  private _shot(): void {
    try {
      const video = this._preview.element;
      if (!video) {
        throw new Error('Video element not found');
      }
      // The preview frame as the shutter is pressed, cropped, mirrored and encoded as it will be sent. A still from
      // `ImageCapture.takePhoto()` was tried on main: with a real camera the preview changed after a shot and a
      // retake.
      this._capture.shoot(video, {
        aspectRatio: this._stream.settings.aspectRatio,
        mirror: this._host.config.get('cameraMirror'),
        quality: this._host.config.get('cameraPhotoQuality'),
      });
    } catch (error) {
      this._host.report('error', 'Failed to take the photo', error, 'camera capturing. Failed to take the photo');
      return;
    }
    // TODO: There are troubles with this, image isn't freezed after shot due to rendering in progress
    this._preview.pause();
  }

  private _startRecording(): void {
    const { feed, settings } = this._stream;
    if (!feed.stream) return;
    const { config } = this._host;
    try {
      this._capture.record(
        feed.stream,
        this._preview.element,
        {
          aspectRatio: settings.aspectRatio,
          mirror: config.get('cameraMirror'),
          recorder: recorderOptions(
            config.get('mediaRecorderOptions'),
            settings.audioQuality,
            config.get('cameraVideoFormats'),
          ),
        },
        // A recorder that ended on its own is stopped like one the shutter stopped: what it recorded goes to review.
        () => this._stopRecording(),
      );
      this._clock.startTimer(
        () => config.get('maxVideoRecordingDuration') ?? undefined,
        () => this._stopRecording(),
      );
    } catch (error) {
      this._host.report('error', 'Failed to start recording', error, 'camera recording. Failed to start recording');
    }
  }

  private _stopRecording(): void {
    // The time limit and the shutter can both ask; only the first stops it.
    if (!this._capture.isRecording) return;
    this._track('stop-camera');
    this._host.runTask(() => this._showRecording());
  }

  /**
   * Once the recorder handed over the clip: shows it for review, then applies what changed while recording. A clip
   * recorded from a stream that was replaced meanwhile is dropped: the preview shows the new one live.
   */
  private async _showRecording(): Promise<void> {
    const clip = await this._host.lifetime.guard(this._capture.stop());
    if (!clip) {
      this._captureResolved();
      return;
    }
    try {
      // The clip is under review whatever the tab says by now: accept and retake go by what was captured.
      this._preview.showClip(this._capture.review(clip), this._clipHandlers);
    } catch (error) {
      this._host.report('error', 'Failed to preview video', error, 'camera previewing. Failed to preview video');
    }
    this._clock.stop();
    this._stream.resume();
  }

  /** Pauses or resumes the recorded clip's preview. */
  private _toggleClipPlayback(): void {
    if (this._capture.isRecording) return;
    this._preview.togglePlayback();
  }

  private _retake(): void {
    this._track('retake-camera');
    this._endReview();
    this._preview.play();
    this._captureResolved();
  }

  private _accept(): void {
    this._track('accept-camera');
    const photo = this._capture.photo;
    const clip = this._capture.clipFile();
    this._endReview();
    // The camera can stay open after the file is added (an `onFileAdd` hook), and a photo can fail to encode: the
    // preview goes back to live either way.
    this._preview.play();
    if (photo) this._host.runTask(() => this._addPhoto(photo));
    if (clip) this._addFile(clip);
    this._captureResolved();
  }

  /** Nothing is under review any more: the capture ends, and a clip's preview gives way to the camera again. */
  private _endReview(): void {
    const clipShown = this._capture.phase === 'recorded';
    this._capture.end();
    this._clock.stop();
    if (clipShown) this._preview.showLive(this._stream.feed.stream);
  }

  private _cameraModes(): CameraMode[] {
    return parseCameraModes(this._host.config.get('cameraModes'));
  }

  /**
   * Falls back to the first configured mode when the current tab isn't one. A capture not yet resolved keeps its tab:
   * the shutter still stops its recording, and its review keeps its actions. So this runs again once the capture is
   * accepted, retaken or dropped, and a `cameraModes` change that waited for it switches the tab then.
   */
  private _captureResolved(): void {
    if (this._capture.phase !== 'live' || this._capture.isStopping) return;
    const cameraModes = this._cameraModes();
    const defaultTab = cameraModes[0];
    if (defaultTab && (!this.activeTab || !cameraModes.includes(this.activeTab))) {
      this._selectTab(defaultTab);
    }
  }

  private async _addPhoto(photo: Promise<Blob>): Promise<void> {
    try {
      const blob = await this._host.lifetime.guard(photo);
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

  /**
   * Stops the camera and forgets what was captured from it: the phase is live again, and the photo or clip under
   * review goes with its stream. A recording can't outlive its stream: it ends with no clip, and one already stopping
   * drops its clip as it arrives.
   */
  private _dropCapture(): void {
    const recording = this._capture.isRecording;
    this._capture.abandon();
    // The recording was the capture a `cameraModes` change waited for.
    if (recording) this._captureResolved();
    this._closeCamera();
  }

  private _closeCamera(): void {
    this._clock.stop();
    const { feed } = this._stream;
    if (!feed.stream) return;
    this._preview.close();
    feed.close();
  }

  private async _openCamera(): Promise<void> {
    const { signal } = this._host.lifetime;
    // Release the current stream first. The prompt state below used to do it, but it is debounced and a quick
    // 'granted' supersedes it, which left the previous camera running after a device switch.
    this._dropCapture();
    try {
      this._access.settleLater('prompt');
      const stream = await this._stream.open(() => this._preview.silence());
      // A later open took over; it settles the permission state.
      if (!stream) return;
      this._preview.show(stream);
      // Ends on a revoked permission, and also when this stream is stopped for the next one; only the first counts.
      const lost = () => {
        if (this._stream.feed.stream === stream) this._access.settleLater('denied');
      };
      stream.addEventListener('inactive', lost);
      // The camera alone can end (unplugged, taken by the system) while the microphone keeps the stream active.
      stream.getVideoTracks()[0]?.addEventListener('ended', lost, { once: true, signal });
      this._access.settleLater('granted');
    } catch (error) {
      // Asks the lifetime, not the error: `getUserMedia` names a camera that fails to start `AbortError` too.
      if (signal.aborted) throw error;
      this._access.settleLater('denied', cameraFailureOf(error));
      this._host.report('warn', 'Failed to capture camera', error, 'camera capturing. Failed to capture camera');
    }
  }
}
