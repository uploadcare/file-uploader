import { audioBitsPerSecond } from '../../../abstract/camera/buildConstraints';
import { pickVideoMimeType, recordingFileType } from '../../../abstract/camera/videoFormat';
import type { CameraAudioQuality } from '../../../types/exported';
import { createCameraFile, guessExtensionByMime } from './cameraFile';
import { createRecordingSource, type RecordingSource } from './recordingSource';

/** A finished recording, as the recorder handed it over. `mirrored`: its mirroring is baked in. */
export type Clip = { blob: Blob; mimeType: string; mirrored: boolean };

/** The clip as a file to upload, named and dated now. */
export const clipFile = (clip: Clip): File =>
  createCameraFile('video', guessExtensionByMime(clip.mimeType), recordingFileType(clip.mimeType), clip.blob);

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

  /**
   * Starts recording `stream`, as `video` shows it. Throws after stopping its canvas when the recorder can't start.
   * `onEnd` runs when the recorder stops, asked or not: it ends on its own when its tracks end or it fails.
   */
  public start(
    stream: MediaStream,
    video: HTMLVideoElement | undefined,
    options: { aspectRatio: number | null; mirror: boolean; recorder: MediaRecorderOptions },
    onEnd: () => void,
  ): void {
    this._source = video
      ? createRecordingSource({ video, stream, aspectRatio: options.aspectRatio, mirror: options.mirror })
      : null;
    // Each recorder fills its own list, so a late chunk from a discarded one stays out of the next clip.
    const chunks: BlobPart[] = [];
    this._chunks = chunks;
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(this._source?.stream ?? stream, options.recorder);
      recorder.start();
    } catch (error) {
      this.releaseSource();
      throw error;
    }
    this._recorder = recorder;
    recorder.addEventListener('dataavailable', (event: BlobEvent) => {
      chunks.push(event.data);
    });
    // Not for a discarded recorder, whose late stop must not end the recording that followed it.
    recorder.addEventListener('stop', () => this._recorder === recorder && onEnd(), { once: true });
  }

  /**
   * Stops recording; resolves with the clip once the recorder has handed over its last chunk, or null when the
   * recording was discarded first. A recorder that ended on its own has handed it over already.
   */
  public stop(): Promise<Clip | null> {
    const recorder = this._recorder;
    // Nothing is recording: there is no final `stop` event to wait for.
    if (!recorder) return Promise.resolve(null);
    const chunks = this._chunks;
    const source = this._source;
    return new Promise((resolve) => {
      const handOver = (): void => {
        if (this._recorder !== recorder) {
          resolve(null);
          return;
        }
        this.releaseSource();
        resolve({
          blob: new Blob(chunks, { type: recorder.mimeType }),
          mimeType: recorder.mimeType,
          mirrored: source?.mirrored ?? false,
        });
      };
      if (recorder.state === 'inactive') {
        handOver();
        return;
      }
      recorder.addEventListener('stop', handOver, { once: true });
      recorder.stop();
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
    this._chunks = [];
    this.releaseSource();
  }
}
