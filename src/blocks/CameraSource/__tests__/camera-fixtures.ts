import { type Mock, vi } from 'vitest';
import { CameraSourceTypes } from '../../../abstract/cameraModes';
import { Lifetime } from '../../../abstract/di/Lifetime';
import { CameraSession, type CameraSessionHost } from '../CameraSession';
import type { CameraLifetime } from '../cameraHost';

const { PHOTO, VIDEO } = CameraSourceTypes;

/** A block-like lifetime over one `Lifetime`: tasks that fail land nowhere. */
export const lifetimeOf = (lifetime = new Lifetime()): CameraLifetime => ({
  whileAdopted: (work, dispose) => lifetime.guard(work, dispose),
  runTask: (task) => lifetime.run(task, () => {}),
  adoptionSignal: () => lifetime.signal,
});

/**
 * A session lent a block-like lifetime: one `Lifetime` per adoption, replaced on a move as `ChildBlock` does. The
 * config allows both modes, audio and every choice; pass `config` to narrow it.
 */
export const setupSession = (config: Partial<CameraSessionHost['config']> = {}) => {
  let adoption = new Lifetime();
  const taskFailed = vi.fn();
  const report = vi.fn();
  const track = vi.fn();
  const addFile = vi.fn();
  const tasks: Promise<unknown>[] = [];
  const host: CameraSessionHost = {
    lifetime: {
      whileAdopted: (work, dispose) => adoption.guard(work, dispose),
      runTask: (task) => {
        let result: unknown;
        adoption.run(() => (result = task()), taskFailed);
        // `run` handled the outcome first, so once this settles the task has also failed or been dropped.
        tasks.push(Promise.resolve(result));
      },
      adoptionSignal: () => adoption.signal,
    },
    config: {
      audioEnabled: () => true,
      mirror: () => false,
      recorderOptions: () => null,
      maxRecordingSeconds: () => undefined,
      cameraModes: () => [PHOTO, VIDEO],
      videoFormats: () => 'webm, mp4',
      constraints: () => null,
      aspectRatio: () => 'native, 1:1',
      resolution: () => 'auto, 720p',
      photoQuality: () => 0.92,
      audioQuality: () => 'auto',
      audioMode: () => 'voice',
      ...config,
    },
    cameraLabel: (index) => `Camera ${index + 1}`,
    navigate: vi.fn(),
    addFile,
    track,
    report,
  };
  const session = new CameraSession(host);
  // The block is re-adopted at once, and nothing releases the session.
  const readopt = () => {
    adoption.end();
    adoption = new Lifetime();
  };
  // A same-task DOM move: the element releases the session, and the block is re-adopted at once.
  const move = () => {
    session.release();
    readopt();
  };
  // The adoption ends and nothing releases the session: whatever is still running belongs to no one.
  const endAdoption = () => adoption.end();
  /** Waits until every task the session started has settled and been reported, the ones they started included. */
  const tasksSettled = async () => {
    for (let seen = -1; seen < tasks.length; ) {
      seen = tasks.length;
      await Promise.allSettled(tasks);
    }
  };
  return { session, host, move, readopt, endAdoption, tasksSettled, report, track, addFile, taskFailed };
};

export type FakeTrack = Omit<MediaStreamTrack, 'stop' | 'applyConstraints' | 'readyState'> & {
  readyState: MediaStreamTrackState;
  stop: Mock<() => void>;
  applyConstraints: Mock<(constraints?: MediaTrackConstraints) => Promise<void>>;
};

export const fakeTrack = (kind: 'audio' | 'video', deviceId = '') =>
  Object.assign(new EventTarget(), {
    kind,
    enabled: true,
    readyState: 'live' as MediaStreamTrackState,
    stop: vi.fn(),
    applyConstraints: vi.fn(async () => {}),
    getSettings: () => ({ deviceId }),
    getCapabilities: () => ({}),
  }) as unknown as FakeTrack;

export const fakeStream = (tracks: FakeTrack[]) =>
  Object.assign(new EventTarget(), {
    getTracks: () => [...tracks],
    getVideoTracks: () => tracks.filter((t) => t.kind === 'video'),
    getAudioTracks: () => tracks.filter((t) => t.kind === 'audio'),
    addTrack: (t: FakeTrack) => {
      tracks.push(t);
    },
    removeTrack: (t: FakeTrack) => {
      tracks.splice(tracks.indexOf(t), 1);
    },
  }) as unknown as Omit<MediaStream, 'getVideoTracks' | 'getAudioTracks'> & {
    getVideoTracks: () => FakeTrack[];
    getAudioTracks: () => FakeTrack[];
  };
export type FakeStream = ReturnType<typeof fakeStream>;

/** A `MediaRecorder` that records nothing: `start`/`stop` flip its state, and tests dispatch its events. */
export class FakeRecorder extends EventTarget {
  public static last: FakeRecorder;
  public static isTypeSupported = () => true;
  public state: RecordingState = 'inactive';
  public mimeType = 'video/webm';
  public stop = vi.fn(() => {
    this.state = 'inactive';
  });
  public constructor() {
    super();
    FakeRecorder.last = this;
  }
  public start(): void {
    this.state = 'recording';
  }
}

/**
 * A canvas that draws into `drawImage` and encodes through `toBlob`, which happy-dom can't do. `toBlob` encodes at
 * once by default; `encode` answers the last `toBlob` by hand.
 */
export const stubCanvas = (toBlob: (done: BlobCallback) => void = (done) => done(new Blob(['jpeg']))) => {
  const drawImage = vi.fn();
  let encode: BlobCallback = () => {};
  const createElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) =>
    tag === 'canvas'
      ? (Object.assign(createElement('div'), {
          getContext: () => ({ drawImage, translate: vi.fn(), scale: vi.fn() }),
          toBlob: (done: BlobCallback) => {
            encode = done;
            toBlob(done);
          },
          captureStream: () => fakeStream([fakeTrack('video', 'canvas')]),
        }) as unknown as HTMLCanvasElement)
      : createElement(tag),
  );
  return { drawImage, encode: (blob: Blob | null) => encode(blob) };
};

/** Animation frames waiting for `runFrames`. */
export const frames: FrameRequestCallback[] = [];

/** Animation frames run only when `runFrames` says so; `cancelAnimationFrame` drops them all. */
export const stubAnimationFrames = () => {
  frames.length = 0;
  vi.stubGlobal('requestAnimationFrame', (frame: FrameRequestCallback) => frames.push(frame));
  vi.stubGlobal('cancelAnimationFrame', () => {
    frames.length = 0;
  });
};

export const runFrames = () => {
  for (const frame of frames.splice(0)) frame(0);
};
