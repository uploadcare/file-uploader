import { type BuildConstraintsInput, buildConstraints } from '../../abstract/camera/buildConstraints';
import { maxShortSideOf } from '../../abstract/camera/cameraSettings';
import { RequestedConstraints } from '../../abstract/camera/RequestedConstraints';
import type { CameraMode } from '../../abstract/cameraModes';
import { signalState } from '../../abstract/di/signalState';
import { CameraDevices } from './CameraDevices';
import { type CameraSetting, CaptureSettings } from './CaptureSettings';
import type { CameraConfig, CameraLifetime, CameraReport } from './cameraHost';
import { CameraFeed } from './media/CameraFeed';
import { MicrophoneSwap } from './media/MicrophoneSwap';

/** What a config change or a pick touches in the open camera. */
export type StreamChange = CameraSetting | 'constraints' | 'audioEnabled';

/** The options the open camera follows, each with what its change touches. */
const WATCHED_OPTIONS = [
  ['cameraAspectRatio', 'aspectRatio'],
  ['cameraResolution', 'resolution'],
  ['cameraAudioQuality', 'audioQuality'],
  ['cameraAudioMode', 'audioMode'],
  ['cameraConstraints', 'constraints'],
  ['enableAudioRecording', 'audioEnabled'],
] as const;

/** What the session lends: its lifetime, the config, and what it knows of the capture. */
export type StreamSettingsHost = {
  lifetime: CameraLifetime;
  config: CameraConfig;
  /** The mode the camera opens for: the active tab, or the tab about to become active. */
  mode: () => CameraMode;
  /** A change made while this holds waits for `resume`: applied to a camera that is recording, it breaks the clip. */
  isRecording: () => boolean;
  cameraLabel: (index: number) => string;
  microphoneLabel: (index: number) => string;
  report: CameraReport;
};

/**
 * How the camera's stream is set up: the constraints it opens with, the devices and settings picked, and every change
 * to them applied to the open camera. It keeps what was last asked of the camera, so only a real change reaches it.
 */
export class StreamSettings {
  /**
   * The camera opened without the microphone because access to it was refused. Cleared once a microphone is in use or
   * none is wanted.
   */
  @signalState() public microphoneDenied = false;

  /** The camera's media stream and its tracks. */
  public readonly feed: CameraFeed;
  public readonly settings: CaptureSettings;
  public readonly devices: CameraDevices;
  private readonly _microphone: MicrophoneSwap;
  private readonly _requested = new RequestedConstraints();

  public constructor(private readonly _host: StreamSettingsHost) {
    this.feed = new CameraFeed(_host.lifetime, _host.report);
    this._microphone = new MicrophoneSwap(_host.lifetime, _host.report);
    this.settings = new CaptureSettings(_host.config);
    this.devices = new CameraDevices({
      ..._host,
      audioEnabled: () => _host.config.get('enableAudioRecording'),
      onDevicesChange: (lists) => {
        this.devices.adopt(lists, this.feed.stream);
        this._syncRequestedConstraints();
      },
    });
  }

  /**
   * Opens the camera with what is in effect, and resolves with its stream; null when a later open took over. The
   * devices are listed the first time, when access makes their labels readable. `beforeAttempt` runs before each
   * request, the retries' too.
   */
  public async open(beforeAttempt: () => void): Promise<MediaStream | null> {
    // The open forgets dropped custom constraints, so it is asked for the configured ones.
    const opened = await this.feed.open(
      this._constraintsInput(this._host.config.get('cameraConstraints')),
      beforeAttempt,
    );
    if (!opened) return null;
    this._requested.opened(opened.constraints);
    this.microphoneDenied = opened.microphoneRefused;
    // Another camera may not do the picked preset: start the resolution picker over if it's no longer offered.
    this.settings.cameraOpened(maxShortSideOf(opened.stream.getVideoTracks()[0]));
    if (!this.devices.cameras.length) this._host.lifetime.runTask(() => this.devices.list());
    // The camera opened with what was in effect when it was asked for. Apply what is in effect now: a preset the
    // camera turned out not to do was left out of the picker, and a pick made while it opened was not applied.
    this.apply('constraints');
    return opened.stream;
  }

  /**
   * Applies what `change` touched to the open camera: the ratio and resolution to the video track, the sound to the
   * microphone, custom constraints to both. The audio bitrate is set when a recording starts, so it needs nothing.
   */
  public apply(change: StreamChange): void {
    const { runTask } = this._host.lifetime;
    if (change === 'aspectRatio' || change === 'resolution' || change === 'constraints') {
      runTask(() => this._applyVideoConstraints());
    }
    if (change === 'audioMode' || change === 'audioEnabled' || change === 'constraints') {
      runTask(() => this._applyAudioConstraints());
    }
  }

  /** Follows the options behind the stream until `adoption` ends. */
  public watchConfig(adoption: AbortSignal): void {
    for (const [option, change] of WATCHED_OPTIONS) {
      const unwatch = this._host.config.observe(option, () => this.configChanged(change));
      adoption.addEventListener('abort', unwatch, { once: true });
    }
  }

  /**
   * The option behind `change` changed in the config: the user's pick gives way to its first listed value, applied to
   * the open camera. A `cameraConstraints` change also forgets that the camera couldn't satisfy the previous ones.
   * `enableAudioRecording` turning on or off adds or drops the microphone, and lists the microphones again or none.
   */
  public configChanged(change: StreamChange): void {
    if (change === 'constraints') {
      this.feed.resetCustomDropped();
    } else if (change === 'audioEnabled') {
      if (this.devices.cameras.length) this._host.lifetime.runTask(() => this.devices.list());
    } else {
      this.settings.reset(change);
    }
    this.apply(change);
  }

  public selectMicrophone(deviceId: string): void {
    this.devices.pickMicrophone(deviceId);
    this._host.lifetime.runTask(() => this._applyAudioConstraints());
  }

  /** The microphone permission changed with the camera open: asks for the microphone again, the camera left alone. */
  public retryMicrophone(): void {
    // No live microphone in the stream: asking for one is a change, even with the request that was refused. A revoke
    // leaves the ended track in the stream.
    if (!this.feed.stream?.getAudioTracks().some((track) => track.readyState === 'live')) this._requested.noAudio();
    this._host.lifetime.runTask(() => this._applyAudioConstraints());
  }

  /** The recording stopped: applies what changed while it ran, video first. */
  public resume(): void {
    const pending = this._requested.flush();
    if (pending.video) this._host.lifetime.runTask(() => this._applyVideoConstraints());
    if (pending.audio) this._host.lifetime.runTask(() => this._applyAudioConstraints());
  }

  /** The changes waiting for a recording to stop are dropped with it. */
  public forgetDeferred(): void {
    this._requested.clearPending();
  }

  /** `custom` defaults to `cameraConstraints`, unless the open camera couldn't satisfy them. */
  private _constraintsInput(
    custom = this.feed.customDropped ? null : this._host.config.get('cameraConstraints'),
  ): BuildConstraintsInput {
    return {
      mode: this._host.mode(),
      enableAudio: this._host.config.get('enableAudioRecording'),
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
    if (this._host.isRecording()) {
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
    if (this._host.isRecording()) {
      this._requested.deferAudio();
      return;
    }
    const { audio } = buildConstraints(this._constraintsInput());
    if (!audio) {
      this._requested.noAudio();
      this.feed.dropAudio();
      this.microphoneDenied = false;
      return;
    }
    const request = this._requested.requestAudio(audio);
    if (!request) return;
    // Audio recording turned off while the microphone opened: its track is stale too.
    const isCurrent = () => this.feed.stream === stream && this._host.config.get('enableAudioRecording');
    const track = await this._microphone.open(audio, isCurrent);
    if (!track) return;
    // Refused after the camera opened: the same denial as a microphone refused with it, unless the one in use still
    // works, which keeps recording sound.
    if (track === 'refused') {
      const live = stream.getAudioTracks().some((old) => old.readyState === 'live');
      if (isCurrent() && !live) this.microphoneDenied = true;
      return;
    }
    // A recording began while it opened: swapping it in now would break the recording, so it waits for the stop.
    if (this._host.isRecording()) {
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
    this.microphoneDenied = false;
  }
}
