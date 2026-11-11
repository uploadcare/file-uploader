import { audioBitsPerSecond } from '../../../abstract/camera/buildConstraints';
import { pickVideoMimeType } from '../../../abstract/camera/videoFormat';
import { signalState } from '../../../abstract/di/signalState';
import type { CameraAudioQuality } from '../../../types/exported';
import { createRecordingSource, type RecordingSource } from './recordingSource';

/** A finished recording, as the recorder handed it over. `mirrored`: its mirroring is baked in. */
export type Clip = { blob: Blob; mimeType: string; mirrored: boolean };

/** The recorder's options: the configured ones, with the audio bitrate and a format the browser can record. */
export const recorderOptions = (
  configured: MediaRecorderOptions | null,
  audioQuality: CameraAudioQuality,
  formats: string,
): MediaRecorderOptions => {
  const options: MediaRecorderOptions = { ...configured };
  const audioBits = audioBitsPerSecond(configured, audioQuality);
  if (audioBits !== undefined) options.audioBitsPerSecond = audioBits;
  const mimeType = pickVideoMimeType({
    explicit: configured?.mimeType,
    formats,
    isSupported: (type) => MediaRecorder.isTypeSupported(type),
  });
  if (mimeType) {
    options.mimeType = mimeType;
  } else {
    // An unsupported type would make the recorder throw: let the browser choose instead.
    delete options.mimeType;
  }
  return options;
};

/** Records the camera stream into a clip, through a canvas that crops and mirrors it like a photo when needed. */
export class VideoRecording {
  private _recorder: MediaRecorder | null = null;
  private _chunks: BlobPart[] = [];
  /** What the recorder records: the camera stream, or a canvas that crops and mirrors it. */
  private _source: RecordingSource | null = null;
  /** The recorder asked to stop, until its final `stop` event. A signal: the camera element's `uc-recording` reads it. */
  @signalState() private _stopping: MediaRecorder | null = null;

  public get isRecording(): boolean {
    return this._recorder?.state === 'recording';
  }

  /** Asked to stop, and the clip is not handed over yet. */
  public get isStopping(): boolean {
    return this._stopping !== null;
  }

  /** Starts recording `stream`, as `video` shows it. Throws after stopping its canvas when the recorder can't start. */
  public start(
    stream: MediaStream,
    video: HTMLVideoElement | undefined,
    options: { aspectRatio: number | null; mirror: boolean; recorder: MediaRecorderOptions },
  ): void {
    this._source = video
      ? createRecordingSource({ video, stream, aspectRatio: options.aspectRatio, mirror: options.mirror })
      : null;
    // Each recorder fills its own list, so a late chunk from a discarded one stays out of the next clip.
    const chunks: BlobPart[] = [];
    this._chunks = chunks;
    try {
      this._recorder = new MediaRecorder(this._source?.stream ?? stream, options.recorder);
      this._recorder.start();
    } catch (error) {
      this.releaseSource();
      throw error;
    }
    this._recorder.addEventListener('dataavailable', (event: BlobEvent) => {
      chunks.push(event.data);
    });
  }

  /**
   * Stops recording; resolves with the clip once the recorder has handed over its last chunk, or null when the
   * recording was discarded first. The canvas stops first, so it never draws the clip's playback.
   */
  public stop(): Promise<Clip | null> {
    const recorder = this._recorder;
    const chunks = this._chunks;
    const source = this._source;
    this._stopping = recorder;
    return new Promise((resolve) => {
      recorder?.addEventListener(
        'stop',
        () => {
          if (this._recorder !== recorder) {
            resolve(null);
            return;
          }
          this._stopping = null;
          this.releaseSource();
          resolve({
            blob: new Blob(chunks, { type: recorder.mimeType }),
            mimeType: recorder.mimeType,
            mirrored: source?.mirrored ?? false,
          });
        },
        { once: true },
      );
      recorder?.stop();
    });
  }

  /** Stops the recording canvas. */
  public releaseSource(): void {
    this._source?.stop();
    this._source = null;
  }

  /** Drops the recording, finished or not, without handing it over. */
  public discard(): void {
    if (this._recorder?.state !== 'inactive') this._recorder?.stop();
    this._recorder = null;
    this._stopping = null;
    this._chunks = [];
    this.releaseSource();
  }
}
