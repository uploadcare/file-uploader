import { sameExceptDevice } from '../../abstract/camera/buildConstraints';

type Requested = MediaStreamConstraints['video'] | MediaStreamConstraints['audio'];

/** Whether `inUse` is the device picked, and `next` asks for it by id on top of the `requested` (serialized) request. */
const sameDeviceRequest = (requested: string | null, next: Requested, inUse?: string, selected?: string | null) =>
  typeof next === 'object' && !!selected && selected === inUse && sameExceptDevice(requested, next);

/**
 * The constraints last asked of the open camera and microphone, serialized to compare against the next request, and
 * the changes waiting for a recording to stop. The last request is not always what applies: a change during a
 * recording waits, and a microphone swap that lands mid-recording is undone.
 */
export class RequestedConstraints {
  private _video: string | null = null;
  private _audio: string | null = null;
  private _videoPending = false;
  private _audioPending = false;

  /** A successful open asked for these. */
  public opened(constraints: MediaStreamConstraints): void {
    this._video = JSON.stringify(constraints.video);
    this._audio = JSON.stringify(constraints.audio);
  }

  /** Device ids in use now named by enumeration: same request, rewritten without reopening. */
  public syncDevices(
    next: MediaStreamConstraints,
    inUse: { cameraId?: string; microphoneId?: string },
    selected: { cameraId: string | null; microphoneId: string | null },
  ): void {
    if (sameDeviceRequest(this._video, next.video, inUse.cameraId, selected.cameraId)) {
      this._video = JSON.stringify(next.video);
    }
    if (sameDeviceRequest(this._audio, next.audio, inUse.microphoneId, selected.microphoneId)) {
      this._audio = JSON.stringify(next.audio);
    }
  }

  /** Clears the video pending flag; false when it equals the last request, else records it. */
  public requestVideo(video: Requested): boolean {
    this._videoPending = false;
    const serialized = JSON.stringify(video);
    if (serialized === this._video) return false;
    this._video = serialized;
    return true;
  }

  /** Clears the audio pending flag; undefined when equal (or no audio), else records it and returns the previous. */
  public requestAudio(audio: Requested): { previous: string | null } | undefined {
    this._audioPending = false;
    const serialized = JSON.stringify(audio);
    if (!audio || serialized === this._audio) return undefined;
    const previous = this._audio;
    this._audio = serialized;
    return { previous };
  }

  /** No microphone is in use (audio recording off, or one refused): asking for one is a change. */
  public noAudio(): void {
    this._audioPending = false;
    this._audio = JSON.stringify(false);
  }

  public deferVideo(): void {
    this._videoPending = true;
  }

  /** Marks audio pending; with `previous`, restores that record first (a swap that landed mid-recording). */
  public deferAudio(previous?: { previous: string | null }): void {
    if (previous) this._audio = previous.previous;
    this._audioPending = true;
  }

  /** The pending flags, cleared. */
  public flush(): { video: boolean; audio: boolean } {
    const pending = { video: this._videoPending, audio: this._audioPending };
    this.clearPending();
    return pending;
  }

  public clearPending(): void {
    this._videoPending = false;
    this._audioPending = false;
  }
}
