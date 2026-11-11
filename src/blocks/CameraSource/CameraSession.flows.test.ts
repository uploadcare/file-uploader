import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { type CameraMode, CameraSourceTypes } from '../../abstract/cameraModes';
import { Lifetime } from '../../abstract/di/Lifetime';
import { delay } from '../../utils/delay';
import { type CameraCommand as CameraAction, CameraSession, type CameraSessionHost } from './CameraSession';
import { CameraFeed } from './media/CameraFeed';
import { VideoRecording } from './media/VideoRecording';
import { RequestedConstraints } from './RequestedConstraints';

/**
 * The camera's flows, pinned before the session is split into parts. Each `inv<N>` names the invariant of the camera
 * refactor design it holds. Tests reach the `<video>` only through `giveVideo`, so the split changes helpers, never
 * assertions.
 */

const { PHOTO, VIDEO } = CameraSourceTypes;

/** A session lent a block-like lifetime: one `Lifetime` per adoption, replaced on a move as `ChildBlock` does. */
const setup = () => {
  let adoption = new Lifetime();
  const taskFailed = vi.fn();
  const report = vi.fn();
  const track = vi.fn();
  const addFile = vi.fn();
  const host: CameraSessionHost = {
    lifetime: {
      whileAdopted: (work, dispose) => adoption.guard(work, dispose),
      runTask: (task) => adoption.run(task, taskFailed),
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
    },
    cameraLabel: (index) => `Camera ${index + 1}`,
    navigate: vi.fn(),
    addFile,
    track,
    report,
  };
  const session = new CameraSession(host);
  // A same-task DOM move: the element releases the session, and the block is re-adopted at once.
  const move = () => {
    session.release();
    adoption.end();
    adoption = new Lifetime();
  };
  // The adoption ends and nothing releases the session: whatever is still running belongs to no one.
  const endAdoption = () => adoption.end();
  return { session, host, move, endAdoption, report, track, addFile, taskFailed };
};

type Ctx = ReturnType<typeof setup>;

const fakeVideo = () =>
  Object.assign(new EventTarget(), {
    srcObject: null as MediaStream | null,
    src: '',
    muted: false,
    volume: 1,
    videoWidth: 640,
    videoHeight: 480,
    paused: true,
    play: vi.fn(async () => {}),
    pause: vi.fn(),
  });
type FakeVideo = ReturnType<typeof fakeVideo>;

/** Lends the session the preview's `<video>`. */
const giveVideo = (ctx: Ctx, video: FakeVideo | undefined) => {
  // The session lets go of the `<video>` only on release.
  if (video) ctx.session.previewVideo(video as unknown as HTMLVideoElement);
  else ctx.session.release();
};

type FakeTrack = Omit<MediaStreamTrack, 'stop' | 'applyConstraints' | 'readyState'> & {
  readyState: MediaStreamTrackState;
  stop: Mock<() => void>;
  applyConstraints: Mock<(constraints?: MediaTrackConstraints) => Promise<void>>;
};

const fakeTrack = (kind: 'audio' | 'video', deviceId: string) =>
  Object.assign(new EventTarget(), {
    kind,
    enabled: true,
    readyState: 'live' as MediaStreamTrackState,
    stop: vi.fn(),
    applyConstraints: vi.fn(async () => {}),
    getSettings: () => ({ deviceId }),
    getCapabilities: () => ({}),
  }) as unknown as FakeTrack;

const fakeStream = (tracks: FakeTrack[]) =>
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
type FakeStream = ReturnType<typeof fakeStream>;

const deviceOf = (constraints: MediaStreamConstraints['video'], fallback: string) =>
  (constraints as { deviceId?: { exact?: string } } | undefined)?.deviceId?.exact ?? fallback;

/** A stream with a track per kind asked for, on the device asked for, else the first one. */
const streamFor = (constraints: MediaStreamConstraints) =>
  fakeStream([
    ...(constraints.video ? [fakeTrack('video', deviceOf(constraints.video, 'cam-1'))] : []),
    ...(constraints.audio ? [fakeTrack('audio', deviceOf(constraints.audio, 'mic-1'))] : []),
  ]);

const stubMedia = () => {
  const streams: FakeStream[] = [];
  const getUserMedia = vi.fn(async (constraints: MediaStreamConstraints) => {
    const stream = streamFor(constraints);
    streams.push(stream);
    return stream;
  });
  /** Holds the next `getUserMedia` call until it is answered. */
  const hold = () => {
    const call = Promise.withResolvers<MediaStream>();
    let asked: MediaStreamConstraints = {};
    getUserMedia.mockImplementationOnce((constraints) => {
      asked = constraints;
      return call.promise as Promise<FakeStream>;
    });
    return {
      answer: () => {
        const stream = streamFor(asked);
        call.resolve(stream);
        return stream;
      },
      fail: (error: unknown) => call.reject(error),
    };
  };
  const device = (kind: MediaDeviceKind, deviceId: string) => ({ kind, deviceId, label: deviceId });
  const mediaDevices = Object.assign(new EventTarget(), {
    getUserMedia,
    enumerateDevices: vi.fn(async () => [
      device('videoinput', 'cam-1'),
      device('videoinput', 'cam-2'),
      device('audioinput', 'mic-1'),
      device('audioinput', 'mic-2'),
    ]),
  });
  /** Fires `change` on a permission to say it changed. */
  const permissionStatus = { camera: new EventTarget(), microphone: new EventTarget() };
  const permissions = { query: async ({ name }: { name: keyof typeof permissionStatus }) => permissionStatus[name] };
  vi.stubGlobal('navigator', { ...navigator, mediaDevices, permissions });
  const microphoneCalls = () => getUserMedia.mock.calls.filter(([constraints]) => !constraints.video);
  return { getUserMedia, streams, hold, microphoneCalls, permissionStatus };
};

class FakeRecorder extends EventTarget {
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

/** Animation frames run only when `runFrames` says so. */
let frames: FrameRequestCallback[] = [];
const runFrames = () => {
  const due = frames;
  frames = [];
  for (const frame of due) frame(0);
};

beforeEach(() => {
  frames = [];
  vi.stubGlobal('MediaRecorder', FakeRecorder);
  vi.stubGlobal('requestAnimationFrame', (frame: FrameRequestCallback) => frames.push(frame));
  vi.stubGlobal('cancelAnimationFrame', () => {
    frames = [];
  });
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:clip');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Opens the camera and waits for the device list, as activation does on screen. */
const open = async ({ session }: Ctx, modes: CameraMode[] = [PHOTO, VIDEO]) => {
  await session.activate(modes);
  await vi.waitFor(() => expect(session.devices.microphones).toHaveLength(2));
};

const startRecording = ({ session }: Ctx) => {
  session.handle({ type: 'select-tab', tab: VIDEO });
  session.handle({ type: 'shutter' });
  return FakeRecorder.last;
};

/** Asks to stop, hands over the recorder's final `stop` event, and waits until the clip is shown. */
const stopRecording = async ({ session }: Ctx, recorder: FakeRecorder) => {
  const shown = vi.mocked(URL.createObjectURL).mock.calls.length;
  session.handle({ type: 'shutter' });
  recorder.dispatchEvent(new Event('stop'));
  await vi.waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledTimes(shown + 1));
};

/** A canvas that draws into `drawImage` and encodes through `toBlob`, which happy-dom can't do. */
const stubCanvas = (toBlob: (done: BlobCallback) => void = (done) => done(new Blob(['jpeg']))) => {
  const drawImage = vi.fn();
  const createElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) =>
    tag === 'canvas'
      ? (Object.assign(createElement('div'), {
          getContext: () => ({ drawImage, translate: vi.fn(), scale: vi.fn() }),
          toBlob,
          captureStream: () => fakeStream([fakeTrack('video', 'canvas')]),
        }) as unknown as HTMLCanvasElement)
      : createElement(tag),
  );
  return { drawImage };
};

/** The camera mirrored and its `<video>` lent, so a recording goes through a canvas that mirrors it. */
const mirrorRecordings = (ctx: Ctx) => {
  ctx.host.config.mirror = () => true;
  const video = fakeVideo();
  giveVideo(ctx, video);
  stubCanvas();
  return video;
};

const lastCallOrder = (mock: Mock) => mock.mock.invocationCallOrder.at(-1) ?? 0;

describe('CameraSession flows', () => {
  it('inv1: a device switch stops the old stream before asking for the new one', async () => {
    const { getUserMedia, streams } = stubMedia();
    const ctx = setup();
    await open(ctx);
    const [oldVideo] = streams[0]?.getVideoTracks() ?? [];

    ctx.session.handle({ type: 'select-camera', deviceId: 'cam-2' });

    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(oldVideo?.stop.mock.invocationCallOrder[0]).toBeLessThan(getUserMedia.mock.invocationCallOrder[1] ?? 0);
  });

  it('inv2: a microphone change opens the new one before stopping the old one and keeps mute', async () => {
    const { getUserMedia, streams } = stubMedia();
    const ctx = setup();
    await open(ctx);
    const live = streams[0];
    const [oldAudio] = live?.getAudioTracks() ?? [];
    ctx.session.handle({ type: 'toggle-microphone' });
    expect(oldAudio?.enabled).toBe(false);

    ctx.session.handle({ type: 'select-microphone', deviceId: 'mic-2' });
    await vi.waitFor(() => expect(oldAudio?.stop).toHaveBeenCalled());

    expect(oldAudio?.stop.mock.invocationCallOrder[0]).toBeGreaterThan(lastCallOrder(getUserMedia));
    const [newAudio] = live?.getAudioTracks() ?? [];
    expect(newAudio).not.toBe(oldAudio);
    expect(newAudio?.getSettings().deviceId).toBe('mic-2');
    expect(newAudio?.enabled).toBe(false);
  });

  it('inv2: a failed microphone change keeps the old track and reports', async () => {
    const { streams, hold } = stubMedia();
    const ctx = setup();
    await open(ctx);
    const [oldAudio] = streams[0]?.getAudioTracks() ?? [];
    const error = new DOMException('Simulated', 'NotReadableError');
    hold().fail(error);

    ctx.session.handle({ type: 'select-microphone', deviceId: 'mic-2' });
    await vi.waitFor(() => expect(ctx.report).toHaveBeenCalled());

    expect(ctx.report).toHaveBeenCalledWith(
      'warn',
      'Failed to apply the microphone settings, keeping the current ones',
      error,
      'camera capturing. Failed to reopen the microphone',
    );
    expect(oldAudio?.stop).not.toHaveBeenCalled();
    expect(streams[0]?.getAudioTracks()).toEqual([oldAudio]);
  });

  it("inv3: a superseded open's stream is stopped and its failure dropped", async () => {
    const { hold } = stubMedia();
    const ctx = setup();
    await open(ctx);
    const first = hold();
    ctx.session.handle({ type: 'select-camera', deviceId: 'cam-2' });
    ctx.session.handle({ type: 'select-camera', deviceId: 'cam-1' });

    const late = first.answer();
    await vi.waitFor(() => expect(late.getVideoTracks()[0]?.stop).toHaveBeenCalled());

    expect(ctx.report).not.toHaveBeenCalled();
    expect(ctx.taskFailed).not.toHaveBeenCalled();
  });

  it('inv3: a superseded microphone swap stops its tracks silently', async () => {
    const { streams, hold } = stubMedia();
    const ctx = setup();
    await open(ctx);
    const first = hold();
    ctx.session.handle({ type: 'select-microphone', deviceId: 'mic-2' });
    ctx.session.handle({ type: 'select-microphone', deviceId: 'mic-1' });
    await vi.waitFor(() => expect(streams).toHaveLength(2));

    const late = first.answer();
    await vi.waitFor(() => expect(late.getAudioTracks()[0]?.stop).toHaveBeenCalled());

    expect(streams[0]?.getAudioTracks()[0]?.getSettings().deviceId).toBe('mic-1');
    expect(ctx.report).not.toHaveBeenCalled();
    expect(ctx.taskFailed).not.toHaveBeenCalled();
  });

  it('inv4: stopping a recording marks it stopping and tracks stop-camera before the recorder stops', async () => {
    stubMedia();
    const ctx = setup();
    await open(ctx);
    const recorder = startRecording(ctx);
    expect(ctx.session.phase).toBe('recording');

    ctx.session.handle({ type: 'shutter' });

    expect(ctx.session.isStopping).toBe(true);
    expect(ctx.track).toHaveBeenLastCalledWith('stop-camera', { tabId: VIDEO });
    expect(ctx.session.phase).toBe('recording');

    recorder.dispatchEvent(new Event('stop'));
    await delay(0);
    expect(ctx.session.phase).toBe('recorded');
  });

  it('inv4: a shutter press while the recorder stops neither stops it again nor starts another', async () => {
    stubMedia();
    const ctx = setup();
    await open(ctx);
    const recorder = startRecording(ctx);
    ctx.session.handle({ type: 'shutter' });
    ctx.track.mockClear();

    ctx.session.handle({ type: 'shutter' });
    ctx.session.handle({ type: 'shutter' });
    recorder.dispatchEvent(new Event('stop'));
    await vi.waitFor(() => expect(ctx.session.phase).toBe('recorded'));

    expect(FakeRecorder.last).toBe(recorder);
    expect(recorder.stop).toHaveBeenCalledOnce();
    expect(recorder.state).toBe('inactive');
    expect(ctx.track).not.toHaveBeenCalled();
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
  });

  it('inv4: the time limit and a shutter press stop the recording once, in either order', async () => {
    stubMedia();
    const ctx = setup();
    const now = vi.spyOn(performance, 'now').mockReturnValue(0);
    ctx.host.config.maxRecordingSeconds = () => 1;
    await open(ctx);

    const pressedFirst = startRecording(ctx);
    ctx.session.handle({ type: 'shutter' });
    now.mockReturnValue(1000);
    runFrames();
    expect(pressedFirst.stop).toHaveBeenCalledOnce();
    pressedFirst.dispatchEvent(new Event('stop'));
    await vi.waitFor(() => expect(ctx.session.phase).toBe('recorded'));
    ctx.session.handle({ type: 'retake' });

    now.mockReturnValue(0);
    const limitFirst = startRecording(ctx);
    now.mockReturnValue(1000);
    runFrames();
    ctx.session.handle({ type: 'shutter' });
    expect(FakeRecorder.last).toBe(limitFirst);
    expect(limitFirst.stop).toHaveBeenCalledOnce();
    expect(ctx.track.mock.calls.filter(([event]) => event === 'stop-camera')).toHaveLength(2);
  });

  it('a mirrored clip plays back unmirrored, and the live preview mirrors again after a retake', async () => {
    stubMedia();
    const ctx = setup();
    mirrorRecordings(ctx);
    await open(ctx);

    const recorder = startRecording(ctx);
    expect(ctx.session.playbackMirrored).toBe(false);
    await stopRecording(ctx, recorder);
    expect(ctx.session.playbackMirrored).toBe(true);

    ctx.session.handle({ type: 'retake' });
    expect(ctx.session.playbackMirrored).toBe(false);
  });

  it('a mirrored recording that fails to start leaves the live preview mirrored', async () => {
    stubMedia();
    const ctx = setup();
    mirrorRecordings(ctx);
    await open(ctx);
    vi.spyOn(FakeRecorder.prototype, 'start').mockImplementation(() => {
      throw new Error('Simulated');
    });

    startRecording(ctx);

    expect(ctx.session.phase).toBe('live');
    expect(ctx.session.playbackMirrored).toBe(false);
  });

  it('a camera reopened during a mirrored recording leaves the live preview mirrored', async () => {
    const { getUserMedia } = stubMedia();
    const ctx = setup();
    mirrorRecordings(ctx);
    await open(ctx);
    startRecording(ctx);

    ctx.session.handle({ type: 'select-camera', deviceId: 'cam-2' });
    await vi.waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));

    expect(ctx.session.playbackMirrored).toBe(false);
  });

  it('a camera reopened during a recording ends the recording without a clip', async () => {
    const { getUserMedia, streams } = stubMedia();
    const ctx = setup();
    const video = fakeVideo();
    giveVideo(ctx, video);
    await open(ctx);
    const recorder = startRecording(ctx);
    ctx.session.handle({ type: 'pick-setting', setting: 'resolution', value: '720p' });
    const discard = vi.spyOn(VideoRecording.prototype, 'discard');

    ctx.session.handle({ type: 'select-camera', deviceId: 'cam-2' });

    expect(discard).toHaveBeenCalledOnce();
    expect(recorder.stop).toHaveBeenCalledOnce();
    expect(ctx.session.isStopping).toBe(false);
    expect(ctx.session.phase).toBe('live');
    expect(frames).toEqual([]);
    await vi.waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
    recorder.dispatchEvent(new Event('stop'));
    await vi.waitFor(() => expect(video.srcObject).toBe(streams[1]));

    // The next recording is a new one, and its stop applies nothing left over from the discarded one. Its clip is the
    // only one made: the discarded recorder's late `stop` made none.
    const next = startRecording(ctx);
    expect(next).not.toBe(recorder);
    const flush = vi.spyOn(RequestedConstraints.prototype, 'flush');
    await stopRecording(ctx, next);
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    expect(flush.mock.results).toEqual([{ type: 'return', value: { video: false, audio: false } }]);
  });

  it('a camera reopened over a mirrored clip mirrors the live preview again', async () => {
    const { getUserMedia, streams } = stubMedia();
    const ctx = setup();
    const video = mirrorRecordings(ctx);
    await open(ctx);
    await stopRecording(ctx, startRecording(ctx));

    ctx.session.handle({ type: 'select-camera', deviceId: 'cam-2' });
    await vi.waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
    // As soon as the new stream shows, not once the permission state settles.
    await vi.waitFor(() => expect(video.srcObject).toBe(streams[1]));
    expect(ctx.session.phase).toBe('recorded');
    expect(ctx.session.playbackMirrored).toBe(false);
    await vi.waitFor(() => expect(ctx.session.phase).toBe('live'));

    expect(ctx.session.playbackMirrored).toBe(false);
  });

  it('inv4: changes made while recording apply after the stop, video first', async () => {
    const { getUserMedia, streams, microphoneCalls } = stubMedia();
    const ctx = setup();
    await open(ctx);
    const [video] = streams[0]?.getVideoTracks() ?? [];
    const recorder = startRecording(ctx);

    ctx.session.handle({ type: 'pick-setting', setting: 'resolution', value: '720p' });
    ctx.session.handle({ type: 'select-microphone', deviceId: 'mic-2' });
    expect(video?.applyConstraints).not.toHaveBeenCalled();
    expect(microphoneCalls()).toHaveLength(0);

    await stopRecording(ctx, recorder);

    expect(video?.applyConstraints).toHaveBeenCalledOnce();
    expect(microphoneCalls()).toHaveLength(1);
    expect(video?.applyConstraints.mock.invocationCallOrder[0]).toBeLessThan(lastCallOrder(getUserMedia));
  });

  it('inv5: a microphone landing after a recording started waits for the stop', async () => {
    const { hold, microphoneCalls } = stubMedia();
    const ctx = setup();
    await open(ctx);
    const slow = hold();
    ctx.session.handle({ type: 'select-microphone', deviceId: 'mic-2' });
    const recorder = startRecording(ctx);

    const late = slow.answer();
    await vi.waitFor(() => expect(late.getAudioTracks()[0]?.stop).toHaveBeenCalled());
    expect(microphoneCalls()).toHaveLength(1);
    expect(ctx.session.feed.stream?.getAudioTracks()[0]?.getSettings().deviceId).toBe('mic-1');

    await stopRecording(ctx, recorder);

    expect(microphoneCalls()).toHaveLength(2);
    expect(deviceOf(microphoneCalls()[1]?.[0].audio, '')).toBe('mic-2');
  });

  it('inv6: enumeration naming the devices in use does not reopen them', async () => {
    const { streams, microphoneCalls } = stubMedia();
    const ctx = setup();
    await open(ctx);
    const [video] = streams[0]?.getVideoTracks() ?? [];
    expect(ctx.session.devices.selectedMicrophoneId).toBe('mic-1');

    ctx.host.config.aspectRatio = () => '1:1';
    ctx.session.configChanged('aspectRatio');
    // `aspectRatio` alone never touches the microphone; `constraints` does, so it is what the device record guards.
    ctx.session.configChanged('constraints');
    await vi.waitFor(() => expect(video?.applyConstraints).toHaveBeenCalled());

    expect(microphoneCalls()).toHaveLength(0);
  });

  it('mutes the preview again before the cameraConstraints fallback reopens the camera', async () => {
    const { getUserMedia, hold } = stubMedia();
    const ctx = setup();
    const video = fakeVideo();
    giveVideo(ctx, video);
    ctx.host.config.constraints = () => ({ video: { width: { exact: 9999 } } });
    const first = hold();
    const retryVolumes: number[] = [];
    getUserMedia.mockImplementationOnce(async (constraints) => {
      retryVolumes.push(video.volume);
      return streamFor(constraints);
    });
    ctx.session.handle({ type: 'request-access' });
    await vi.waitFor(() => expect(getUserMedia).toHaveBeenCalledOnce());
    expect(video.volume).toBe(0);

    // A clip shown while the first request is pending unmutes the preview.
    video.volume = 1;
    first.fail(new DOMException('Simulated', 'OverconstrainedError'));
    await vi.waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));

    expect(retryVolumes).toEqual([0]);
  });

  it('a camera reopened after its custom constraints were dropped asks for them again', async () => {
    const { getUserMedia } = stubMedia();
    const ctx = setup();
    ctx.host.config.constraints = () => ({ video: { width: { exact: 9999 } } });
    getUserMedia.mockRejectedValueOnce(new DOMException('Simulated', 'OverconstrainedError'));
    await open(ctx);
    expect(ctx.session.feed.customDropped).toBe(true);

    ctx.session.handle({ type: 'select-camera', deviceId: 'cam-2' });
    await vi.waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(3));

    expect(getUserMedia.mock.calls[2]?.[0].video).toMatchObject({ width: { exact: 9999 } });
  });

  it('inv6: a failed live request is not retried', async () => {
    const { streams } = stubMedia();
    const ctx = setup();
    await open(ctx);
    const [video] = streams[0]?.getVideoTracks() ?? [];
    video?.applyConstraints.mockRejectedValue(new DOMException('Simulated refusal', 'OverconstrainedError'));
    ctx.host.config.aspectRatio = () => '1:1';

    ctx.session.configChanged('aspectRatio');
    await vi.waitFor(() => expect(ctx.report).toHaveBeenCalled());
    ctx.session.configChanged('aspectRatio');

    expect(video?.applyConstraints).toHaveBeenCalledOnce();
    expect(ctx.report).toHaveBeenCalledWith(
      'warn',
      'The camera cannot apply the camera settings, keeping the current ones',
      expect.any(DOMException),
      'camera capturing. the camera settings could not be applied',
    );
  });

  it('inv7: a pick made while the camera opens is applied once it opens', async () => {
    const { hold } = stubMedia();
    const ctx = setup();
    const opening = hold();
    const activation = ctx.session.activate([PHOTO, VIDEO]);
    await vi.waitFor(() => expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled());

    ctx.session.handle({ type: 'pick-setting', setting: 'aspectRatio', value: '1:1' });
    const stream = opening.answer();
    await activation;

    expect(stream.getVideoTracks()[0]?.applyConstraints).toHaveBeenCalledWith(
      expect.objectContaining({ aspectRatio: { ideal: 1 } }),
    );
  });

  it('inv8: release cancels the pending permission state and the recording', async () => {
    vi.useFakeTimers();
    stubMedia();
    const ctx = setup();
    await ctx.session.activate([PHOTO, VIDEO]);
    const recorder = startRecording(ctx);

    ctx.session.release();
    await vi.advanceTimersByTimeAsync(1000);

    expect(ctx.session.permission).toBe('idle');
    expect(recorder.stop).toHaveBeenCalledOnce();
  });

  it('a move during a recording drops the phase, and the camera opens on the configured tab', async () => {
    const { getUserMedia } = stubMedia();
    const ctx = setup();
    await open(ctx);
    startRecording(ctx);
    const config = vi.spyOn(ctx.host.config, 'cameraModes');

    ctx.move();

    expect(ctx.session.isStopping).toBe(false);
    expect(ctx.session.phase).toBe('live');
    expect(config).not.toHaveBeenCalled();

    ctx.host.config.cameraModes = () => [PHOTO];
    await ctx.session.activate([PHOTO]);
    expect(ctx.session.activeTab).toBe(PHOTO);
    expect(getUserMedia).toHaveBeenCalledTimes(2);
  });

  it('inv8: picks, devices and tab survive a move', async () => {
    const { getUserMedia } = stubMedia();
    const ctx = setup();
    await open(ctx);
    ctx.session.handle({ type: 'select-tab', tab: VIDEO });
    ctx.session.handle({ type: 'pick-setting', setting: 'resolution', value: '720p' });
    ctx.session.handle({ type: 'select-camera', deviceId: 'cam-2' });
    await vi.waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));

    ctx.move();
    await ctx.session.activate([PHOTO, VIDEO]);

    expect(ctx.session.activeTab).toBe(VIDEO);
    expect(ctx.session.settings.resolution).toBe('720p');
    expect(ctx.session.devices.selectedCameraId).toBe('cam-2');
    expect(deviceOf(getUserMedia.mock.lastCall?.[0].video, '')).toBe('cam-2');
  });

  it('inv9: the timer shows at once and stops at the limit once', async () => {
    stubMedia();
    const ctx = setup();
    const now = vi.spyOn(performance, 'now').mockReturnValue(0);
    ctx.host.config.maxRecordingSeconds = () => 1;
    await open(ctx);

    const recorder = startRecording(ctx);
    expect(ctx.session.clock.timerText).toBe('00:01');

    now.mockReturnValue(1000);
    runFrames();
    runFrames();

    expect(ctx.session.clock.timerText).toBe('00:00');
    expect(recorder.stop).toHaveBeenCalledOnce();
  });

  it('inv10: a shot draws then pauses, and the file is made at accept', async () => {
    stubMedia();
    const ctx = setup();
    const video = fakeVideo();
    giveVideo(ctx, video);
    const { drawImage } = stubCanvas();
    const date = vi.spyOn(Date, 'now').mockReturnValue(1000);
    await open(ctx, [PHOTO]);

    ctx.session.handle({ type: 'shutter' });
    expect(video.pause.mock.invocationCallOrder[0]).toBeGreaterThan(drawImage.mock.invocationCallOrder[0] ?? 0);
    expect(ctx.addFile).not.toHaveBeenCalled();

    date.mockReturnValue(2000);
    ctx.session.handle({ type: 'accept' });
    await vi.waitFor(() => expect(ctx.addFile).toHaveBeenCalled());

    const [file] = ctx.addFile.mock.lastCall as [File];
    expect([file.name, file.lastModified]).toEqual(['camera-2000.jpeg', 2000]);
  });

  it('a photo that fails to encode is not an unhandled rejection, and accept still reports it', async () => {
    stubMedia();
    const ctx = setup();
    giveVideo(ctx, fakeVideo());
    stubCanvas((done) => done(null));
    await open(ctx, [PHOTO]);
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      ctx.session.handle({ type: 'shutter' });
      await delay(10);
      expect(unhandled).not.toHaveBeenCalled();

      ctx.session.handle({ type: 'accept' });
      await vi.waitFor(() => expect(ctx.report).toHaveBeenCalled());
      expect(ctx.report).toHaveBeenCalledWith(
        'error',
        'Failed to create the photo',
        expect.objectContaining({ message: 'Failed to encode the photo' }),
        'camera capturing. Failed to create the photo',
      );
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });

  it('inv10: retake returns to live and stops the timeline', async () => {
    const { streams } = stubMedia();
    const ctx = setup();
    const video = fakeVideo();
    giveVideo(ctx, video);
    await open(ctx);
    await stopRecording(ctx, startRecording(ctx));
    expect(video.srcObject).toBeNull();
    expect(video.src).toBe('blob:clip');

    ctx.session.handle({ type: 'retake' });

    expect(video.srcObject).toBe(streams[0]);
    expect(video.muted).toBe(true);
    expect(video.play).toHaveBeenCalledOnce();
    video.dispatchEvent(new Event('play'));
    expect(ctx.session.timelineIcon).toBe('play');
  });

  it('a retaken or accepted clip lets go of its recording', async () => {
    stubMedia();
    const ctx = setup();
    giveVideo(ctx, fakeVideo());
    await open(ctx);
    const discard = vi.spyOn(VideoRecording.prototype, 'discard');

    await stopRecording(ctx, startRecording(ctx));
    ctx.session.handle({ type: 'retake' });
    expect(discard).toHaveBeenCalledOnce();

    await stopRecording(ctx, startRecording(ctx));
    ctx.session.handle({ type: 'accept' });
    expect(ctx.addFile).toHaveBeenCalledOnce();
    expect(discard).toHaveBeenCalledTimes(2);
  });

  it('drops a clip that arrives after the camera reopened, and waits for it before recording again', async () => {
    vi.useFakeTimers();
    const { streams } = stubMedia();
    const ctx = setup();
    const video = fakeVideo();
    giveVideo(ctx, video);
    await open(ctx);
    const first = startRecording(ctx);
    ctx.session.handle({ type: 'shutter' });

    ctx.session.handle({ type: 'select-camera', deviceId: 'cam-2' });
    await vi.advanceTimersByTimeAsync(1000);
    expect(ctx.session.phase).toBe('live');
    ctx.session.handle({ type: 'shutter' });
    expect(FakeRecorder.last).toBe(first);

    first.dispatchEvent(new Event('stop'));
    await vi.advanceTimersByTimeAsync(0);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(ctx.session.phase).toBe('live');
    expect(video.srcObject).toBe(streams[1]);
    video.dispatchEvent(new Event('play'));
    expect(ctx.session.timelineIcon).toBe('play');

    ctx.session.handle({ type: 'shutter' });
    expect(FakeRecorder.last).not.toBe(first);
    expect(ctx.session.phase).toBe('recording');
  });

  it('a clip dropped after the camera reopened leaves no deferred change for the next recording', async () => {
    vi.useFakeTimers();
    const { hold } = stubMedia();
    const ctx = setup();
    giveVideo(ctx, fakeVideo());
    await open(ctx);
    const first = startRecording(ctx);
    ctx.session.handle({ type: 'pick-setting', setting: 'resolution', value: '720p' });
    ctx.session.handle({ type: 'select-microphone', deviceId: 'mic-2' });
    ctx.session.handle({ type: 'shutter' });
    const reopen = hold();
    ctx.session.handle({ type: 'select-camera', deviceId: 'cam-2' });

    first.dispatchEvent(new Event('stop'));
    await vi.advanceTimersByTimeAsync(0);
    reopen.answer();
    await vi.advanceTimersByTimeAsync(1000);

    // The reopen asked for everything in effect, so nothing waits for the next stop.
    const flush = vi.spyOn(RequestedConstraints.prototype, 'flush');
    const next = startRecording(ctx);
    expect(next).not.toBe(first);
    await stopRecording(ctx, next);
    expect(flush.mock.results).toEqual([{ type: 'return', value: { video: false, audio: false } }]);
  });

  it('a cameraModes change waits for the recording, its review and the accept before switching the tab', async () => {
    stubMedia();
    const ctx = setup();
    giveVideo(ctx, fakeVideo());
    await open(ctx);
    const recorder = startRecording(ctx);

    ctx.host.config.cameraModes = () => [PHOTO];
    ctx.session.selectDefaultTab([PHOTO]);
    expect(ctx.session.activeTab).toBe(VIDEO);
    expect(ctx.session.phase).toBe('recording');

    // The stop button still stops the recording rather than taking a photo.
    await stopRecording(ctx, recorder);
    expect(recorder.stop).toHaveBeenCalledOnce();
    expect(ctx.session.phase).toBe('recorded');
    expect(ctx.session.activeTab).toBe(VIDEO);

    ctx.session.handle({ type: 'accept' });
    expect(ctx.addFile).toHaveBeenCalledOnce();
    expect(ctx.session.activeTab).toBe(PHOTO);
  });

  it('a cameraModes change waits for a photo under review to be retaken before switching the tab', async () => {
    stubMedia();
    const ctx = setup();
    giveVideo(ctx, fakeVideo());
    stubCanvas();
    await open(ctx);
    ctx.session.handle({ type: 'shutter' });
    expect(ctx.session.phase).toBe('shot');

    ctx.host.config.cameraModes = () => [VIDEO];
    ctx.session.selectDefaultTab([VIDEO]);
    expect(ctx.session.activeTab).toBe(PHOTO);

    ctx.session.handle({ type: 'retake' });
    expect(ctx.session.phase).toBe('live');
    expect(ctx.session.activeTab).toBe(VIDEO);
  });

  it('audio recording turned off lets go of the microphone, and turned on again opens it', async () => {
    const { getUserMedia, streams } = stubMedia();
    const ctx = setup();
    await open(ctx);
    const live = streams[0];
    const [video] = live?.getVideoTracks() ?? [];
    const [audio] = live?.getAudioTracks() ?? [];

    ctx.host.config.audioEnabled = () => false;
    ctx.session.configChanged('audioEnabled');

    expect(audio?.stop).toHaveBeenCalledOnce();
    expect(live?.getAudioTracks()).toEqual([]);
    expect(video?.stop).not.toHaveBeenCalled();
    expect(getUserMedia).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(ctx.session.devices.microphones).toEqual([]));

    // Back on: the same microphone settings as before are a change again.
    ctx.host.config.audioEnabled = () => true;
    ctx.session.configChanged('audioEnabled');
    await vi.waitFor(() => expect(live?.getAudioTracks()).toHaveLength(1));
  });

  it('audio recording turned on opens the microphone into the open camera', async () => {
    const { getUserMedia, streams, microphoneCalls } = stubMedia();
    const ctx = setup();
    ctx.host.config.audioEnabled = () => false;
    await ctx.session.activate([PHOTO, VIDEO]);
    await vi.waitFor(() => expect(ctx.session.devices.cameras).toHaveLength(2));
    expect(getUserMedia.mock.lastCall?.[0].audio).toBe(false);
    const live = streams[0];

    ctx.host.config.audioEnabled = () => true;
    ctx.session.configChanged('audioEnabled');
    await vi.waitFor(() => expect(live?.getAudioTracks()).toHaveLength(1));

    expect(microphoneCalls()).toHaveLength(1);
    expect(live?.getVideoTracks()[0]?.stop).not.toHaveBeenCalled();
    expect(live?.getAudioTracks()[0]?.enabled).toBe(true);
    await vi.waitFor(() => expect(ctx.session.devices.microphones).toHaveLength(2));
  });

  it('a microphone whose stream changes between the swap resolving and the commit is stopped, not swapped in', async () => {
    const { hold } = stubMedia();
    const ctx = setup();
    await open(ctx);
    const slow = hold();
    ctx.session.handle({ type: 'select-microphone', deviceId: 'mic-2' });
    // The swap's own check passes, and queues the stream's end in the microtask before the session resumes.
    ctx.host.config.audioEnabled = () => {
      ctx.host.config.audioEnabled = () => true;
      queueMicrotask(() => ctx.session.feed.close());
      return true;
    };

    const late = slow.answer();

    await vi.waitFor(() => expect(late.getAudioTracks()[0]?.stop).toHaveBeenCalled());
    expect(late.getAudioTracks()).toHaveLength(1);
  });

  it('a microphone that opens after audio recording was turned off is stopped, not swapped in', async () => {
    const { streams, hold } = stubMedia();
    const ctx = setup();
    await open(ctx);
    const live = streams[0];
    const slow = hold();
    ctx.session.handle({ type: 'select-microphone', deviceId: 'mic-2' });

    ctx.host.config.audioEnabled = () => false;
    ctx.session.configChanged('audioEnabled');
    const late = slow.answer();
    await vi.waitFor(() => expect(late.getAudioTracks()[0]?.stop).toHaveBeenCalled());

    expect(live?.getAudioTracks()).toEqual([]);
  });

  it('a microphone permission granted again after a revoke opens the microphone, its ended track still in the stream', async () => {
    const { streams, hold, microphoneCalls, permissionStatus } = stubMedia();
    const ctx = setup();
    await open(ctx);
    const live = streams[0];
    const [ended] = live?.getAudioTracks() ?? [];
    // Revoked: the track ends but stays in the stream, and the microphone is refused.
    if (ended) ended.readyState = 'ended';
    hold().fail(new DOMException('Simulated', 'NotAllowedError'));
    permissionStatus.microphone.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(ctx.report).toHaveBeenCalled());

    permissionStatus.microphone.dispatchEvent(new Event('change'));

    await vi.waitFor(() => expect(microphoneCalls()).toHaveLength(2));
    await vi.waitFor(() => expect(live?.getAudioTracks()[0]?.readyState).toBe('live'));
    expect(ended?.stop).toHaveBeenCalled();
  });

  it('a microphone permission granted again during a recording, after a revoke, opens the microphone after the stop', async () => {
    const { streams, microphoneCalls, permissionStatus } = stubMedia();
    const ctx = setup();
    await open(ctx);
    const [ended] = streams[0]?.getAudioTracks() ?? [];
    const recorder = startRecording(ctx);
    if (ended) ended.readyState = 'ended';
    // Revoked, then granted again, both while recording.
    permissionStatus.microphone.dispatchEvent(new Event('change'));
    permissionStatus.microphone.dispatchEvent(new Event('change'));
    await delay(0);
    expect(microphoneCalls()).toHaveLength(0);

    await stopRecording(ctx, recorder);

    await vi.waitFor(() => expect(microphoneCalls()).toHaveLength(1));
  });

  it('a microphone permission granted with the camera open adds the microphone and keeps the photo under review', async () => {
    const { getUserMedia, streams, hold, microphoneCalls, permissionStatus } = stubMedia();
    const ctx = setup();
    ctx.host.config.audioEnabled = () => false;
    giveVideo(ctx, fakeVideo());
    stubCanvas();
    await ctx.session.activate([PHOTO, VIDEO]);
    await vi.waitFor(() => expect(ctx.session.devices.cameras).toHaveLength(2));
    const live = streams[0];
    ctx.session.handle({ type: 'shutter' });
    expect(ctx.session.phase).toBe('shot');

    // Turned on, and the microphone is refused at first.
    hold().fail(new DOMException('Simulated', 'NotAllowedError'));
    ctx.host.config.audioEnabled = () => true;
    ctx.session.configChanged('audioEnabled');
    await vi.waitFor(() => expect(ctx.report).toHaveBeenCalled());

    permissionStatus.microphone.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(live?.getAudioTracks()).toHaveLength(1));

    expect(microphoneCalls()).toHaveLength(2);
    expect(getUserMedia.mock.calls.filter(([constraints]) => constraints.video)).toHaveLength(1);
    expect(live?.getVideoTracks()[0]?.stop).not.toHaveBeenCalled();
    expect(ctx.session.phase).toBe('shot');

    // A camera permission change still opens the camera again.
    permissionStatus.camera.dispatchEvent(new Event('change'));
    expect(getUserMedia.mock.calls.filter(([constraints]) => constraints.video)).toHaveLength(2);
  });

  it('audio recording turned off during a recording applies after the stop', async () => {
    const { streams } = stubMedia();
    const ctx = setup();
    await open(ctx);
    const [audio] = streams[0]?.getAudioTracks() ?? [];
    const recorder = startRecording(ctx);

    ctx.host.config.audioEnabled = () => false;
    ctx.session.configChanged('audioEnabled');
    expect(audio?.stop).not.toHaveBeenCalled();

    await stopRecording(ctx, recorder);
    expect(audio?.stop).toHaveBeenCalledOnce();
    expect(streams[0]?.getAudioTracks()).toEqual([]);
  });

  it('a camera track that ends on its own stops the capture, the microphone too', async () => {
    vi.useFakeTimers();
    const { streams } = stubMedia();
    const ctx = setup();
    await open(ctx);
    const [video] = streams[0]?.getVideoTracks() ?? [];
    const [audio] = streams[0]?.getAudioTracks() ?? [];

    video?.dispatchEvent(new Event('ended'));
    await vi.runAllTimersAsync();

    expect(ctx.session.permission).toBe('denied');
    expect(audio?.stop).toHaveBeenCalled();
    expect(video?.stop).toHaveBeenCalled();
  });

  it("a replaced camera's track ending changes nothing", async () => {
    vi.useFakeTimers();
    const { getUserMedia, streams } = stubMedia();
    const ctx = setup();
    await open(ctx);
    const [oldVideo] = streams[0]?.getVideoTracks() ?? [];
    ctx.session.handle({ type: 'select-camera', deviceId: 'cam-2' });
    await vi.waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));

    oldVideo?.dispatchEvent(new Event('ended'));
    await vi.runAllTimersAsync();

    expect(ctx.session.permission).toBe('granted');
    expect(streams[1]?.getAudioTracks()[0]?.stop).not.toHaveBeenCalled();
  });

  it('inv11: a denied permission stops the capture and keeps the clip URL', async () => {
    vi.useFakeTimers();
    const { streams } = stubMedia();
    const ctx = setup();
    const video = fakeVideo();
    giveVideo(ctx, video);
    await open(ctx);
    await stopRecording(ctx, startRecording(ctx));
    expect(ctx.session.phase).toBe('recorded');
    const live = streams[0];

    live?.dispatchEvent(new Event('inactive'));
    await vi.runAllTimersAsync();

    expect(ctx.session.phase).toBe('live');
    expect(ctx.session.permission).toBe('denied');
    expect(live?.getVideoTracks()[0]?.stop).toHaveBeenCalled();
    expect(video.src).toBe('blob:clip');
    // QUIRK(camera): the denied state stops the stream (`CameraFeed.close`, CameraFeed.ts:87) but keeps the clip's
    // object URL and `src` until the next clip, retake or release revokes it. Pinned as current behaviour, not endorsed.
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });
});

/** The remaining branches, so every line of the session and its parts is covered before they move. */
describe('CameraSession edges', () => {
  it('drops a permission state that settles after the adoption ended', async () => {
    vi.useFakeTimers();
    stubMedia();
    const ctx = setup();
    await ctx.session.activate([PHOTO]);

    ctx.endAdoption();
    await vi.runAllTimersAsync();

    expect(ctx.session.permission).toBe('idle');
  });

  it('plays and pauses the clip under review, and the icon and timeline follow', async () => {
    stubMedia();
    const ctx = setup();
    const video = fakeVideo();
    giveVideo(ctx, video);
    await open(ctx);
    const clip = startRecording(ctx);
    // A toggle while recording does nothing.
    ctx.session.handle({ type: 'toggle-playback' });
    expect(video.play).not.toHaveBeenCalled();
    await stopRecording(ctx, clip);

    ctx.session.handle({ type: 'toggle-playback' });
    expect(video.play).toHaveBeenCalledOnce();
    Object.assign(video, { paused: false, ended: false, readyState: 4, currentTime: 0.5, duration: 2 });
    video.dispatchEvent(new Event('play'));
    expect(ctx.session.timelineIcon).toBe('pause');
    expect(`scaleX(${ctx.session.clock.progress})`).toBe('scaleX(0.25)');

    ctx.session.handle({ type: 'toggle-playback' });
    expect(video.pause).toHaveBeenCalledOnce();
    video.dispatchEvent(new Event('pause'));
    expect(ctx.session.timelineIcon).toBe('play');
    expect(frames).toEqual([]);
  });

  it('records nothing before the camera opens', () => {
    const start = vi.spyOn(FakeRecorder.prototype, 'start');
    const ctx = setup();
    startRecording(ctx);
    expect(start).not.toHaveBeenCalled();
    expect(ctx.session.phase).toBe('live');
  });

  it('stops the timeline when the preview is gone', async () => {
    stubMedia();
    const ctx = setup();
    const video = fakeVideo();
    giveVideo(ctx, video);
    await open(ctx);
    await stopRecording(ctx, startRecording(ctx));

    giveVideo(ctx, undefined);
    video.dispatchEvent(new Event('play'));

    expect(frames).toEqual([]);
  });

  it('reports a device list that fails', async () => {
    const error = new Error('Simulated');
    stubMedia();
    vi.mocked(navigator.mediaDevices.enumerateDevices).mockRejectedValue(error);
    const ctx = setup();
    await ctx.session.activate([PHOTO]);

    await vi.waitFor(() =>
      expect(ctx.report).toHaveBeenCalledWith(
        'warn',
        'Failed to get devices',
        error,
        'camera devices. Failed to get devices',
      ),
    );
  });

  it('drops a device list that answers after the adoption ended', async () => {
    stubMedia();
    const listing = Promise.withResolvers<MediaDeviceInfo[]>();
    vi.mocked(navigator.mediaDevices.enumerateDevices).mockReturnValue(listing.promise);
    const ctx = setup();
    await ctx.session.activate([PHOTO]);

    ctx.endAdoption();
    listing.resolve([]);
    await delay(0);

    expect(ctx.report).not.toHaveBeenCalled();
    expect(ctx.taskFailed).not.toHaveBeenCalled();
  });

  it('a config change gives a pick back to the first listed value', async () => {
    stubMedia();
    const ctx = setup();
    ctx.host.config.audioQuality = () => 'auto, high';
    ctx.session.handle({ type: 'pick-setting', setting: 'audioQuality', value: 'high' });
    expect(ctx.session.settings.audioQuality).toBe('high');

    ctx.session.configChanged('audioQuality');

    expect(ctx.session.settings.audioQuality).toBe('auto');
  });

  it('navigates back and closes', () => {
    const ctx = setup();
    ctx.session.handle({ type: 'back' });
    ctx.session.handle({ type: 'close' });
    expect(vi.mocked(ctx.host.navigate).mock.calls).toEqual([['onBack'], ['onClose']]);
  });

  it('toggles no playback without a video element', () => {
    const { session, taskFailed } = setup();
    session.handle({ type: 'toggle-playback' });
    expect(taskFailed).not.toHaveBeenCalled();
  });

  it('throws on an action it does not know', () => {
    const { session } = setup();
    expect(() => session.handle({ type: 'bogus' } as unknown as CameraAction)).toThrow('Unknown camera action: bogus');
  });

  it('throws on a shot without a video element', () => {
    const { session } = setup();
    session.handle({ type: 'select-tab', tab: PHOTO });
    expect(() => session.handle({ type: 'shutter' })).toThrow('Video element not found');
  });

  it('reports a clip it cannot preview, and still ends the recording', async () => {
    stubMedia();
    const ctx = setup();
    giveVideo(ctx, fakeVideo());
    await open(ctx);
    const error = new Error('Simulated');
    vi.mocked(URL.createObjectURL).mockImplementation(() => {
      throw error;
    });

    await stopRecording(ctx, startRecording(ctx));

    expect(ctx.report).toHaveBeenCalledWith(
      'error',
      'Failed to preview video',
      error,
      'camera previewing. Failed to preview video',
    );
    expect(ctx.session.phase).toBe('recorded');
  });

  it('passes on a play() failure that is not an interruption', async () => {
    const ctx = setup();
    const video = fakeVideo();
    const error = new Error('Simulated');
    video.play.mockRejectedValue(error);
    giveVideo(ctx, video);

    ctx.session.handle({ type: 'retake' });

    await vi.waitFor(() => expect(ctx.taskFailed).toHaveBeenCalledWith(error));
  });

  it('drops a recording that stops after the adoption ended', async () => {
    stubMedia();
    const ctx = setup();
    giveVideo(ctx, fakeVideo());
    await open(ctx);
    const recorder = startRecording(ctx);
    ctx.session.handle({ type: 'shutter' });

    ctx.endAdoption();
    recorder.dispatchEvent(new Event('stop'));
    await delay(0);

    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(ctx.session.phase).toBe('recording');
    expect(ctx.taskFailed).not.toHaveBeenCalled();
  });

  it('drops a photo that encodes after the adoption ended', async () => {
    stubMedia();
    const ctx = setup();
    giveVideo(ctx, fakeVideo());
    let encode: BlobCallback = () => {};
    stubCanvas((done) => {
      encode = done;
    });
    await open(ctx, [PHOTO]);
    ctx.session.handle({ type: 'shutter' });
    ctx.session.handle({ type: 'accept' });

    ctx.endAdoption();
    encode(new Blob(['jpeg']));
    await delay(0);

    expect(ctx.addFile).not.toHaveBeenCalled();
    expect(ctx.report).not.toHaveBeenCalled();
    expect(ctx.taskFailed).not.toHaveBeenCalled();
  });

  it('starts the resolution picker over when the reopened camera cannot do the pick', async () => {
    const { hold } = stubMedia();
    const ctx = setup();
    await open(ctx);
    ctx.session.handle({ type: 'pick-setting', setting: 'resolution', value: '720p' });
    const reopen = hold();
    ctx.session.handle({ type: 'select-camera', deviceId: 'cam-2' });

    const [track] = reopen.answer().getVideoTracks();
    if (track) track.getCapabilities = () => ({ width: { max: 640 }, height: { max: 480 } });
    await vi.waitFor(() => expect(ctx.session.settings.maxShortSide).toBe(480));

    expect(ctx.session.settings.resolution).toBe('auto');
  });
});

describe('CameraFeed', () => {
  it('ignores a microphone swap without a stream', () => {
    const stream = new CameraFeed(setup().host.lifetime, vi.fn());
    const track = fakeTrack('audio', 'mic-2');
    stream.swapAudioTrack(track);
    expect(track.stop).not.toHaveBeenCalled();
  });
});
