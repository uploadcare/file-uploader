import { afterEach, describe, expect, it, vi } from 'vitest';
import { CameraSourceTypes } from '../../abstract/cameraModes';
import { Lifetime } from '../../abstract/di/Lifetime';
import { delay } from '../../utils/delay';
import { CameraSession, type CameraSessionHost } from './CameraSession';

/** A session lent a block-like lifetime: one `Lifetime` per adoption, replaced on a move as `ChildBlock` does. */
const setup = () => {
  let adoption = new Lifetime();
  const taskFailed = vi.fn();
  const report = vi.fn();
  const host: CameraSessionHost = {
    lifetime: {
      whileAdopted: (work, dispose) => adoption.guard(work, dispose),
      runTask: (task) => adoption.run(task, taskFailed),
      adoptionSignal: () => adoption.signal,
    },
    config: {
      audioEnabled: () => false,
      mirror: () => false,
      recorderOptions: () => null,
      maxRecordingSeconds: () => undefined,
      cameraModes: () => [CameraSourceTypes.PHOTO],
      videoFormats: () => 'webm, mp4',
      constraints: () => null,
      aspectRatio: () => '',
      resolution: () => 'auto',
      photoQuality: () => 0.92,
      audioQuality: () => 'auto',
      audioMode: () => 'voice',
    },
    cameraLabel: (index) => `Camera ${index + 1}`,
    navigate: () => {},
    addFile: () => {},
    track: () => {},
    report,
  };
  // A same-task DOM move: the block is released and re-adopted at once.
  const move = () => {
    adoption.end();
    adoption = new Lifetime();
  };
  return { session: new CameraSession(host), host, move, taskFailed, report };
};

const stubMedia = () => {
  const pending: PromiseWithResolvers<MediaStream>[] = [];
  const getUserMedia = vi.fn(() => {
    const call = Promise.withResolvers<MediaStream>();
    pending.push(call);
    return call.promise;
  });
  const mediaDevices = Object.assign(new EventTarget(), {
    getUserMedia,
    enumerateDevices: vi.fn(async () => []),
  });
  const permissions = { query: async () => new EventTarget() };
  vi.stubGlobal('navigator', { ...navigator, mediaDevices, permissions });
  const stream = () => ({ getTracks: () => [{ stop: vi.fn() }] }) as unknown as MediaStream;
  return { getUserMedia, pending, stream };
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('CameraSession moved while the camera is asked for', () => {
  it('stops the activation while the camera opens, without reporting it', async () => {
    const { getUserMedia, pending, stream } = stubMedia();
    const { session, move, report } = setup();
    const activation = session.activate([CameraSourceTypes.PHOTO]);
    await vi.waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));
    // A camera the released activation still opened would answer at once, so a regression fails, not hangs.
    getUserMedia.mockResolvedValue(stream());

    move();
    pending[0]?.resolve(stream());
    await expect(activation).rejects.toThrow(/owner of this work is gone/);

    expect(report).not.toHaveBeenCalled();
    // The released activation opens no camera under the next adoption.
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it('drops the capture without reporting it or denying access', async () => {
    vi.useFakeTimers();
    const { getUserMedia, pending, stream } = stubMedia();
    const { session, move, taskFailed, report } = setup();
    session.handle({ type: 'request-access' });
    await vi.waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));

    move();
    pending[0]?.resolve(stream());
    // Settles the capture and the permission state's debounce.
    await vi.runAllTimersAsync();

    expect(report).not.toHaveBeenCalled();
    expect(taskFailed).not.toHaveBeenCalled();
    expect(session.permission).not.toBe('denied');
  });
});

describe('CameraSession preview playback', () => {
  it('takes a play() interrupted by a pause or a new source as superseded, not as a failure', async () => {
    const { session, taskFailed } = setup();
    const interrupted = new DOMException('The play() request was interrupted by a new load request.', 'AbortError');
    const play = vi.fn(() => Promise.reject(interrupted));
    session.previewVideo({ play } as unknown as HTMLVideoElement);

    session.handle({ type: 'retake' });
    await delay(0);

    expect(play).toHaveBeenCalledOnce();
    expect(taskFailed).not.toHaveBeenCalled();
  });
});
