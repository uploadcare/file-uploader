/** Stops every track of `stream`, which releases the camera and the microphone. */
export const stopTracks = (stream: MediaStream): void => {
  for (const track of stream.getTracks()) track.stop();
};

type CameraStreamOptions = {
  video: () => HTMLVideoElement | undefined;
  /** The recorded clip started or stopped playing in the preview. */
  onClipPlay: () => void;
  onClipPause: () => void;
};

/**
 * The camera's media stream and what the video element shows: the live stream, or a recorded clip. `srcObject` is
 * assigned by hand rather than bound in the template, because binding it stops the video pausing on a shot.
 */
export class CameraStream {
  private _stream: MediaStream | null = null;
  private _source: MediaStream | null = null;
  /** Counts the opens, so one answered after a later open began knows it was superseded. */
  private _opens = 0;
  /** Object URL of the clip being previewed; revoked when replaced or released. */
  private _clipUrl: string | null = null;

  public constructor(private readonly _options: CameraStreamOptions) {}

  public get stream(): MediaStream | null {
    return this._stream;
  }

  /**
   * Opens the camera with `constraints` and shows it. `guard` binds the wait to the owner's lifetime, stopping a
   * stream that arrives after it. Only the latest open counts: one that a later open overtook resolves to null, its
   * stream stopped (left running, it holds the camera and can freeze the one on screen) or its failure dropped.
   */
  public async open(
    constraints: MediaStreamConstraints,
    guard: (work: Promise<MediaStream>, dispose: (stream: MediaStream) => void) => Promise<MediaStream>,
  ): Promise<MediaStream | null> {
    const open = ++this._opens;
    const video = this._options.video();
    // Muted so Firefox doesn't feed the microphone back.
    if (video) video.volume = 0;
    let stream: MediaStream;
    try {
      stream = await guard(navigator.mediaDevices.getUserMedia(constraints), stopTracks);
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
    this._setSource(stream);
    return stream;
  }

  /** Stops the camera. Returns whether it was running. */
  public close(): boolean {
    const stream = this._stream;
    if (!stream) return false;
    const video = this._options.video();
    if (video) video.volume = 0;
    this._detachClipListeners();
    this._setSource(null);
    stopTracks(stream);
    this._stream = null;
    return true;
  }

  /** Flips the microphone; returns whether it is muted now, or undefined without one. */
  public toggleAudio(): boolean | undefined {
    let muted: boolean | undefined;
    for (const track of this._stream?.getAudioTracks() ?? []) {
      track.enabled = !track.enabled;
      muted = !track.enabled;
    }
    return muted;
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

  /** Shows a recorded clip in place of the live stream. */
  public showClip(clip: Blob): void {
    const video = this._options.video();
    if (!video) return;
    this._revokeClipUrl();
    this._clipUrl = URL.createObjectURL(clip);
    video.muted = false;
    video.volume = 1;
    this._setSource(null);
    video.src = this._clipUrl;
    this._detachClipListeners();
    video.addEventListener('play', this._options.onClipPlay);
    video.addEventListener('pause', this._options.onClipPause);
  }

  /** Goes back from a clip to the live stream. */
  public showLive(): void {
    this._detachClipListeners();
    this._revokeClipUrl();
    this._setSource(this._stream);
    const video = this._options.video();
    if (video) video.muted = true;
  }

  /** Applies the source to the video element: when it changes, and once the preview has rendered the element. */
  public sync(): void {
    const video = this._options.video();
    if (video && video.srcObject !== this._source) {
      video.srcObject = this._source;
    }
  }

  /** Lets go of the video element and the clip. */
  public release(): void {
    this._detachClipListeners();
    this._setSource(null);
    this._revokeClipUrl();
  }

  private _setSource(stream: MediaStream | null): void {
    if (this._source === stream) return;
    this._source = stream;
    this.sync();
  }

  private _detachClipListeners(): void {
    const video = this._options.video();
    video?.removeEventListener('play', this._options.onClipPlay);
    video?.removeEventListener('pause', this._options.onClipPause);
  }

  private _revokeClipUrl(): void {
    if (this._clipUrl) {
      URL.revokeObjectURL(this._clipUrl);
      this._clipUrl = null;
    }
  }
}
