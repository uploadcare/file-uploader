import { type BuildConstraintsInput, buildConstraints } from '../../../abstract/camera/buildConstraints';
import { isAbortError } from '../../../abstract/di/Lifetime';
import { signalState } from '../../../abstract/di/signalState';
import type { CameraLifetime, CameraSessionHost } from '../CameraSession';
import { stopTracks } from './tracks';

const isOverconstrained = (error: unknown): boolean => (error as Error | null)?.name === 'OverconstrainedError';

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
    private readonly _report: CameraSessionHost['report'],
  ) {}

  public get stream(): MediaStream | null {
    return this._stream;
  }

  public get customDropped(): boolean {
    return this._customDropped;
  }

  /** Before every open and on a `cameraConstraints` change: the next constraints include them again. */
  public resetCustomDropped(): void {
    this._customDropped = false;
  }

  /**
   * Opens the stream with the constraints built from `input`. If `cameraConstraints` asks for something the camera
   * can't do, opens it once more without them rather than showing the camera as denied. Only the latest open counts:
   * one that a later open overtook resolves to null, its stream stopped (left running, it holds the camera and can
   * freeze the one on screen) or its failure dropped. `beforeAttempt` runs before each request, the retry's too.
   */
  public async open(
    input: BuildConstraintsInput,
    beforeAttempt: () => void,
  ): Promise<{ stream: MediaStream; constraints: MediaStreamConstraints } | null> {
    try {
      return await this._open(buildConstraints(input), beforeAttempt);
    } catch (error) {
      if (!input.custom || !isOverconstrained(error)) throw error;
      this._report(
        'warn',
        'The camera cannot satisfy cameraConstraints, opening it without them',
        error,
        'camera capturing. cameraConstraints could not be satisfied',
      );
      this._customDropped = true;
      return this._open(buildConstraints({ ...input, custom: null }), beforeAttempt);
    }
  }

  private async _open(
    constraints: MediaStreamConstraints,
    beforeAttempt: () => void,
  ): Promise<{ stream: MediaStream; constraints: MediaStreamConstraints } | null> {
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

  /** Stops the camera. Returns whether it was running. */
  public close(): boolean {
    const stream = this._stream;
    if (!stream) return false;
    stopTracks(stream);
    this._stream = null;
    return true;
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
