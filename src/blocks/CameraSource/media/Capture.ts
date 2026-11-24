import { signalState } from '../../../abstract/di/signalState';
import type { CameraPhase } from '../cameraTypes';
import { type PhotoOptions, renderPhoto } from './PhotoCapture';
import { type Clip, clipFile, VideoRecording } from './VideoRecording';

/** What is captured right now, each state with what it holds until it ends. */
type CaptureState =
  | { is: 'live' }
  /** The photo under review, as the JPEG it will be sent as. */
  | { is: 'shot'; photo: Promise<Blob> }
  | { is: 'recording' }
  /** The recorder was asked to stop. `dropped`: its camera is gone, so its clip is let go as it arrives. */
  | { is: 'stopping'; dropped: boolean }
  /** The clip under review, and its object URL for the preview: null when it could not be made. */
  | { is: 'recorded'; clip: Clip; url: string | null };

const LIVE: CaptureState = { is: 'live' };

/**
 * The capture, from the shutter to accept or retake: a photo taken, a clip being recorded, or one recorded. The one
 * holder of what is under review, so every way out of a state lets go of the same things.
 */
export class Capture {
  @signalState() private _state = LIVE;
  /** The recorded clip's play/pause icon. */
  @signalState() public timelineIcon: 'play' | 'pause' = 'play';

  private readonly _recorder = new VideoRecording();

  /** A recorder still stopping shows as recording, or as live once its camera is gone. */
  public get phase(): CameraPhase {
    const state = this._state;
    if (state.is === 'stopping') return state.dropped ? 'live' : 'recording';
    return state.is;
  }

  public get isRecording(): boolean {
    return this._state.is === 'recording';
  }

  /** The recording was asked to stop and its clip is not handed over yet. */
  public get isStopping(): boolean {
    return this._state.is === 'stopping';
  }

  /** The clip shown for review has its mirroring baked in, so the preview must not mirror it again. */
  public get playbackMirrored(): boolean {
    const state = this._state;
    return state.is === 'recorded' && state.url !== null && state.clip.mirrored;
  }

  /** The photo under review, still encoding. */
  public get photo(): Promise<Blob> | null {
    const state = this._state;
    return state.is === 'shot' ? state.photo : null;
  }

  /** The clip under review as a file to upload, named and dated now. */
  public clipFile(): File | null {
    const state = this._state;
    return state.is === 'recorded' ? clipFile(state.clip) : null;
  }

  /** Draws the frame `video` shows and starts encoding it, synchronously; the caller pauses the preview after. */
  public shoot(video: HTMLVideoElement, options: Pick<PhotoOptions, 'aspectRatio' | 'mirror' | 'quality'>): void {
    const photo = renderPhoto(video, { ...options, width: video.videoWidth, height: video.videoHeight });
    // Accept awaits and reports a failure; until then (or after a retake) the rejection would go unhandled.
    photo.catch(() => {});
    this.end();
    this._state = { is: 'shot', photo };
  }

  /** Starts recording `stream`, as `video` shows it. Throws when the recorder can't start, and nothing is captured. */
  public record(...recording: Parameters<VideoRecording['start']>): void {
    this.end();
    this._recorder.start(...recording);
    this._state = { is: 'recording' };
  }

  /**
   * Stops the recording; resolves with the clip for `review` once the recorder handed it over. Null when there is
   * none: nothing was recording, the capture ended first, or the clip was dropped as it arrived.
   */
  public async stop(): Promise<Clip | null> {
    if (!this.isRecording) return null;
    this._state = { is: 'stopping', dropped: false };
    const clip = await this._recorder.stop();
    const state = this._state;
    if (clip && state.is === 'stopping' && state.dropped) {
      this.end();
      return null;
    }
    return clip;
  }

  /** Puts `clip` under review; returns its object URL for the preview. Throws when the URL can't be made. */
  public review(clip: Clip): string {
    this._revoke();
    this._state = { is: 'recorded', clip, url: null };
    const url = URL.createObjectURL(clip.blob);
    this._state = { is: 'recorded', clip, url };
    return url;
  }

  /** The clip under review started or stopped playing. */
  public playing(on: boolean): void {
    this.timelineIcon = on ? 'pause' : 'play';
  }

  /**
   * Ends the capture, whatever it is: the photo is forgotten, the recording dropped without a clip, the clip let go
   * with its URL. The encoded clip stays in the recorder's chunks until then.
   */
  public end(): void {
    const state = this._state;
    this._revoke();
    if (state.is !== 'live' && state.is !== 'shot') this._recorder.discard();
    this._state = LIVE;
  }

  /**
   * The camera the capture came from is gone, and the capture with it. A recorder already stopping can't be hurried:
   * it stays until its clip arrives, which `stop` then drops.
   */
  public abandon(): void {
    const state = this._state;
    if (state.is !== 'stopping') {
      this.end();
    } else if (!state.dropped) {
      this._recorder.releaseSource();
      this._state = { is: 'stopping', dropped: true };
    }
  }

  private _revoke(): void {
    const state = this._state;
    if (state.is === 'recorded' && state.url) URL.revokeObjectURL(state.url);
  }
}
