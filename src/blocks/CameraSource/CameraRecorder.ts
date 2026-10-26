const DEFAULT_VIDEO_FORMAT = 'video/webm';

/** `mimeType` when the browser can record it, else WebM, else MP4. */
export const pickMimeType = (mimeType: string | undefined): string => {
  if (mimeType && MediaRecorder.isTypeSupported(mimeType)) return mimeType;
  if (MediaRecorder.isTypeSupported(DEFAULT_VIDEO_FORMAT)) return DEFAULT_VIDEO_FORMAT;
  return 'video/mp4';
};

const KNOWN_CONTAINERS: Record<string, string> = {
  mp4: 'mp4',
  ogg: 'ogg',
  webm: 'webm',
  quicktime: 'mov',
  'x-matroska': 'mkv',
};

/** The file extension for a recorded clip's mime type, e.g. `video/x-matroska;codecs=avc1,opus` → `mkv`. */
export const guessExtensionByMime = (mime: string | undefined): string => {
  // MediaRecorder.mimeType is an empty string in Firefox, which records WebM by default.
  // @link https://bugzilla.mozilla.org/show_bug.cgi?id=1512175
  if (mime === '') return 'webm';
  const [kind, ...rest] = mime?.split('/') ?? [];
  if (kind === 'video') {
    const container = rest.join('/').split(';')[0];
    if (container && KNOWN_CONTAINERS[container]) return KNOWN_CONTAINERS[container];
  }
  return 'avi';
};

/** A captured photo or clip as a file named after its kind and the time. */
export const createCameraFile = (type: 'camera' | 'video', ext: string, format: string, blob: Blob): File => {
  const date = Date.now();
  return new File([blob], `${type}-${date}.${ext}`, { lastModified: date, type: format });
};

/** Records a camera stream into a clip: picks a supported format, collects the chunks and names the file. */
export class CameraRecorder {
  private _recorder: MediaRecorder | null = null;
  private _chunks: BlobPart[] = [];

  public get isRecording(): boolean {
    return this._recorder?.state === 'recording';
  }

  /** Starts recording `stream`; `options.mimeType` is used when the browser supports it. */
  public start(stream: MediaStream, options: MediaRecorderOptions = {}): void {
    this._chunks = [];
    this._recorder = new MediaRecorder(stream, { ...options, mimeType: pickMimeType(options.mimeType) });
    this._recorder.start();
    this._recorder.addEventListener('dataavailable', (event: BlobEvent) => {
      this._chunks.push(event.data);
    });
  }

  /** Stops recording; `onStopped` runs once the recorder has handed over its last chunk. */
  public stop(onStopped: () => void): void {
    this._recorder?.addEventListener('stop', onStopped);
    this._recorder?.stop();
  }

  /** The clip recorded so far, for the preview. */
  public clip(): Blob {
    return new Blob(this._chunks, { type: this._recorder?.mimeType });
  }

  /** The recorded clip as a file to upload; the recorded chunks are let go. */
  public takeFile(): File {
    const blob = this.clip();
    const ext = guessExtensionByMime(this._recorder?.mimeType);
    this._chunks = [];
    return createCameraFile('video', ext, `video/${ext}`, blob);
  }
}

export function formatTime(time: number): string {
  const minutes = Math.floor(time / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor(time % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${seconds}`;
}

/** Drives the recording timer and the playback timeline, one animation frame at a time. */
export class RecordingClock {
  private _frame: number | null = null;
  private _startTime = 0;

  /**
   * Shows the recording time in `display`: the time left when `maxSeconds()` gives a limit, else the time so far.
   * `onLimit` runs when the time is up.
   */
  public startTimer(
    display: () => HTMLElement | undefined,
    maxSeconds: () => number | undefined,
    onLimit: () => void,
  ): void {
    this._startTime = performance.now();
    const tick = (): void => {
      const elapsed = Math.floor((performance.now() - this._startTime) / 1000);
      const max = maxSeconds();
      if (typeof max === 'number' && max > 0) {
        const remaining = max - elapsed;
        const element = display();
        if (element) element.textContent = formatTime(remaining);
        if (remaining <= 0) {
          onLimit();
          return;
        }
      } else {
        const element = display();
        if (element) element.textContent = formatTime(elapsed);
      }
      this._frame = requestAnimationFrame(tick);
    };
    tick();
  }

  /** Follows `video`'s playback in the timeline bar and the time display. */
  public startTimeline(
    video: () => HTMLVideoElement | undefined,
    line: () => HTMLElement | undefined,
    display: () => HTMLElement | undefined,
  ): void {
    const tick = (): void => {
      const element = video();
      if (!element) return;
      const { currentTime } = element;
      const duration = element.duration || 1;
      const bar = line();
      if (bar) bar.style.transform = `scaleX(${currentTime / duration})`;
      const time = display();
      if (time) time.textContent = formatTime(currentTime);
      this._frame = requestAnimationFrame(tick);
    };
    tick();
  }

  public stop(): void {
    if (this._frame) cancelAnimationFrame(this._frame);
  }
}
