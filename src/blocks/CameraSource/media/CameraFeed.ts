import { type BuildConstraintsInput, buildConstraints } from '../../../abstract/camera/buildConstraints';
import { isAbortError } from '../../../abstract/di/Lifetime';
import { signalState } from '../../../abstract/di/signalState';
import { cameraFailureOf } from '../CameraAccess';
import type { CameraLifetime, CameraReport } from '../cameraHost';
import { stopTracks } from './tracks';

const isOverconstrained = (error: unknown): boolean => (error as Error | null)?.name === 'OverconstrainedError';

type Opened = { stream: MediaStream; constraints: MediaStreamConstraints };

/** The camera's media stream and its tracks: opens it, applies changed settings to it, and stops it. */
export class CameraFeed {
  /** Whether the microphone is muted. A new stream's microphone starts on. */
  @signalState() public audioMuted = false;

  private _stream: MediaStream | null = null;
  /** Counts the opens, so one answered after a later open began knows it was superseded. */
  private _opens = 0;
  /**
   * Set when the camera opened without `cameraConstraints` because it couldn't satisfy them. Later changes are applied
   * without them too, until the option changes or the camera opens again.
   */
  private _customDropped = false;

  public constructor(
    private readonly _lifetime: CameraLifetime,
    private readonly _report: CameraReport,
  ) {}

  public get stream(): MediaStream | null {
    return this._stream;
  }

  public get customDropped(): boolean {
    return this._customDropped;
  }

  /** On a `cameraConstraints` change: the next constraints include them again. */
  public resetCustomDropped(): void {
    this._customDropped = false;
  }

  /**
   * Opens the stream with the constraints built from `input`. If `cameraConstraints` asks for something the camera
   * can't do, opens it once more without them rather than showing the camera as denied. Only the latest open counts:
   * one that a later open overtook resolves to null, its stream stopped (left running, it holds the camera and can
   * freeze the one on screen) or its failure dropped. `beforeAttempt` runs before each request, the retries' too.
   * Each open asks for `cameraConstraints` again, so `input.custom` is the configured value. A refused request that
   * asked for the microphone is asked once more without it, so a refused microphone doesn't take the camera with it;
   * the constraints handed back are then still the ones asked for, microphone included, and `microphoneRefused` says so.
   */
  public async open(
    input: BuildConstraintsInput,
    beforeAttempt: () => void,
  ): Promise<(Opened & { microphoneRefused: boolean }) | null> {
    this._customDropped = false;
    try {
      return await this._openOrWithoutMicrophone(buildConstraints(input), beforeAttempt);
    } catch (error) {
      if (!input.custom || !isOverconstrained(error)) throw error;
      this._report(
        'warn',
        'The camera cannot satisfy cameraConstraints, opening it without them',
        error,
        'camera capturing. cameraConstraints could not be satisfied',
      );
      this._customDropped = true;
      return this._openOrWithoutMicrophone(buildConstraints({ ...input, custom: null }), beforeAttempt);
    }
  }

  private async _openOrWithoutMicrophone(
    constraints: MediaStreamConstraints,
    beforeAttempt: () => void,
  ): Promise<(Opened & { microphoneRefused: boolean }) | null> {
    try {
      const opened = await this._open(constraints, beforeAttempt);
      return opened && { ...opened, microphoneRefused: false };
    } catch (error) {
      if (!constraints.audio || cameraFailureOf(error) !== 'denied') throw error;
      const opens = this._opens;
      const dismissed = await this._promptDismissed();
      // A later open began while the permissions were read; it decides what the camera shows, refused or not.
      if (opens !== this._opens) return null;
      if (dismissed) throw error;
      const opened = await this._open({ ...constraints, audio: false }, beforeAttempt);
      // Reported once it is clear only the microphone was refused; a camera refused too is the caller's to report.
      // The context is the one the refusal reported under before the camera opened without the microphone.
      if (opened) {
        this._report(
          'warn',
          'The microphone was refused, opening the camera without it',
          error,
          'camera capturing. Failed to capture camera',
        );
      }
      return opened && { ...opened, constraints, microphoneRefused: true };
    }
  }

  /**
   * Whether a refusal was a prompt closed without an answer, which Chrome also rejects as `NotAllowedError`: the camera
   * can still be asked for, and the microphone was not refused. Asking for the camera alone then would prompt again,
   * and an allowed camera would blame the microphone. Without the Permissions API, it reads as a refusal.
   */
  private async _promptDismissed(): Promise<boolean> {
    try {
      const [camera, microphone] = await this._lifetime.whileAdopted(
        Promise.all(
          (['camera', 'microphone'] as const).map((name) =>
            navigator.permissions.query({ name: name as PermissionName }),
          ),
        ),
      );
      return camera?.state === 'prompt' && microphone?.state !== 'denied';
    } catch (error) {
      if (isAbortError(error)) throw error;
      return false;
    }
  }

  private async _open(constraints: MediaStreamConstraints, beforeAttempt: () => void): Promise<Opened | null> {
    const open = ++this._opens;
    beforeAttempt();
    let stream: MediaStream;
    try {
      stream = await this._lifetime.whileAdopted(navigator.mediaDevices.getUserMedia(constraints), stopTracks);
    } catch (error) {
      // A failure is the superseded open's own; the later one decides what the camera shows.
      if (open !== this._opens) return null;
      throw error;
    }
    if (open !== this._opens) {
      stopTracks(stream);
      return null;
    }
    this._stream = stream;
    this.audioMuted = false;
    return { stream, constraints };
  }

  /** Stops the camera, if it runs. */
  public close(): void {
    if (!this._stream) return;
    stopTracks(this._stream);
    this._stream = null;
  }

  /** Flips the microphone; without one, nothing changes. */
  public toggleAudio(): void {
    let muted: boolean | undefined;
    for (const track of this._stream?.getAudioTracks() ?? []) {
      track.enabled = !track.enabled;
      muted = !track.enabled;
    }
    if (muted !== undefined) this.audioMuted = muted;
  }

  /**
   * Swaps the microphone track for `track`, which keeps the camera running. A muted microphone stays muted. The old
   * tracks are stopped once the new one is in.
   */
  public swapAudioTrack(track: MediaStreamTrack): void {
    const stream = this._stream;
    if (!stream) return;
    const previous = stream.getAudioTracks();
    track.enabled = previous.every((old) => old.enabled);
    for (const old of previous) {
      stream.removeTrack(old);
      old.stop();
    }
    stream.addTrack(track);
  }

  /** Stops the microphone and takes it out of the stream; the camera keeps running. A new one starts unmuted. */
  public dropAudio(): void {
    const stream = this._stream;
    if (!stream) return;
    for (const track of stream.getAudioTracks()) {
      stream.removeTrack(track);
      track.stop();
    }
    this.audioMuted = false;
  }

  /**
   * Applies changed video constraints to the open camera without reopening it, so there is no new permission prompt
   * and no black frame. A failure keeps the current ones; `customInvolved` says whether to blame `cameraConstraints`.
   */
  public async applyVideo(video: MediaTrackConstraints, customInvolved: boolean): Promise<void> {
    const track = this._stream?.getVideoTracks()[0];
    if (!track) return;
    try {
      await this._lifetime.whileAdopted(track.applyConstraints(video));
    } catch (error) {
      if (isAbortError(error)) throw error;
      const subject = customInvolved ? 'the camera settings or cameraConstraints' : 'the camera settings';
      this._report(
        'warn',
        `The camera cannot apply ${subject}, keeping the current ones`,
        error,
        `camera capturing. ${subject} could not be applied`,
      );
    }
  }
}
