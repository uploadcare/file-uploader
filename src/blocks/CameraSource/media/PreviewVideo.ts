import { isAbortError } from '../../../abstract/di/Lifetime';
import { signalState } from '../../../abstract/di/signalState';
import type { CameraLifetime } from '../CameraSession';

/** The recorded clip started or stopped playing in the preview. */
export type ClipHandlers = { onPlay: () => void; onPause: () => void };

/**
 * The preview's `<video>`, lent by `<uc-camera-preview>` for the adoption, and what it shows: the live stream, or a
 * recorded clip. Everything here is synchronous, so a shot, a retake and the recording canvas see the frame they
 * expect. `srcObject` is assigned by hand rather than bound in the template, because binding it stops the video pausing
 * on a shot.
 */
export class PreviewVideo {
  /**
   * The shutter waits for a frame: a shot before the first one draws an empty canvas, which accepting drops. Cleared
   * whenever the shown source changes, so the shutter does not wait for the video's `emptied` to disable.
   */
  @signalState() public hasVideoFrame = false;

  private _video: HTMLVideoElement | undefined;
  private _source: MediaStream | null = null;
  private _clip: ClipHandlers | null = null;

  public constructor(private readonly _runTask: CameraLifetime['runTask']) {}

  public get element(): HTMLVideoElement | undefined {
    return this._video;
  }

  /** The preview rendered its `<video>`: shows the current source in it. */
  public attach(video: HTMLVideoElement): void {
    this._video = video;
    this._apply();
  }

  public frame(ready: boolean): void {
    this.hasVideoFrame = ready;
  }

  /** Before the camera is asked for: muted so Firefox doesn't feed the microphone back. */
  public silence(): void {
    if (this._video) this._video.volume = 0;
  }

  public show(stream: MediaStream | null): void {
    if (this._source === stream) return;
    this._source = stream;
    this.hasVideoFrame = false;
    this._apply();
  }

  /** Shows the recorded clip at `url` in place of the live stream. */
  public showClip(url: string, handlers: ClipHandlers): void {
    const video = this._video;
    if (!video) return;
    video.muted = false;
    video.volume = 1;
    this.show(null);
    this.hasVideoFrame = false;
    video.src = url;
    this._detachClip();
    this._clip = handlers;
    video.addEventListener('play', handlers.onPlay);
    video.addEventListener('pause', handlers.onPause);
  }

  /** Goes back from a clip to the live `stream`. */
  public showLive(stream: MediaStream | null): void {
    this._detachClip();
    this.show(stream);
    if (this._video) this._video.muted = true;
  }

  /** Before the camera stops: lets go of the stream and the clip's listeners. */
  public close(): void {
    this.silence();
    this._detachClip();
    this.show(null);
  }

  public play(): void {
    const video = this._video;
    if (!video) return;
    this._runTask(() =>
      video.play().catch((error: unknown) => {
        // A pause or a new source interrupts a pending play(): superseded, not a failure.
        if (!isAbortError(error)) throw error;
      }),
    );
  }

  public pause(): void {
    this._video?.pause();
  }

  /** Pauses or resumes the clip under review. */
  public togglePlayback(): void {
    const video = this._video;
    if (!video) return;
    if (!video.paused && !video.ended && video.readyState > 2) {
      video.pause();
    } else if (video.paused) {
      this.play();
    }
  }

  /** Where the clip's playback is, for its timeline; null once the preview is gone. */
  public sample(): { currentTime: number; duration: number } | null {
    const video = this._video;
    return video ? { currentTime: video.currentTime, duration: video.duration || 1 } : null;
  }

  /** Lets go of the video element. */
  public release(): void {
    this._detachClip();
    this.show(null);
    this._video = undefined;
  }

  private _apply(): void {
    const video = this._video;
    if (video && video.srcObject !== this._source) {
      video.srcObject = this._source;
    }
  }

  private _detachClip(): void {
    const clip = this._clip;
    if (!clip) return;
    this._clip = null;
    this._video?.removeEventListener('play', clip.onPlay);
    this._video?.removeEventListener('pause', clip.onPause);
  }
}
