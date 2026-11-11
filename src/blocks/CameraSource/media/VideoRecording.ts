import { audioBitsPerSecond } from '../../../abstract/camera/buildConstraints';
import { pickVideoMimeType } from '../../../abstract/camera/videoFormat';
import type { CameraAudioQuality } from '../../../types/exported';
import { createRecordingSource, type RecordingSource } from './recordingSource';

/** A finished recording, as the recorder handed it over. */
export type Clip = { blob: Blob; mimeType: string };

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

  public get isRecording(): boolean {
    return this._recorder?.state === 'recording';
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
      const source = this._source;
      source?.stop();
      // Its mirroring stays for releaseSource(); its canvas is already stopped.
      if (source) this._source = { ...source, stop: () => {} };
      throw error;
    }
    this._recorder.addEventListener('dataavailable', (event: BlobEvent) => {
      chunks.push(event.data);
    });
  }

  /** Stops recording; resolves with the clip once the recorder has handed over its last chunk. */
  public stop(): Promise<Clip> {
    const recorder = this._recorder;
    const chunks = this._chunks;
    return new Promise((resolve) => {
      recorder?.addEventListener(
        'stop',
        () => resolve({ blob: new Blob(chunks, { type: recorder.mimeType }), mimeType: recorder.mimeType }),
        { once: true },
      );
      recorder?.stop();
    });
  }

  /** Stops the recording canvas. Returns whether the clip has its mirroring baked in. */
  public releaseSource(): boolean {
    const mirrored = this._source?.mirrored ?? false;
    this._source?.stop();
    this._source = null;
    return mirrored;
  }

  /** Drops the recording, finished or not, without handing it over. */
  public discard(): void {
    if (this._recorder?.state !== 'inactive') this._recorder?.stop();
    this._recorder = null;
    this._chunks = [];
  }
}
