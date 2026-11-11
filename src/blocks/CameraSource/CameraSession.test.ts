import { afterEach, describe, expect, it, vi } from 'vitest';
import { CameraSourceTypes } from '../../abstract/cameraModes';
import { delay } from '../../utils/delay';
import { setupSession } from './__tests__/camera-fixtures';

const setup = () =>
  setupSession({
    audioEnabled: () => false,
    cameraModes: () => [CameraSourceTypes.PHOTO],
    aspectRatio: () => '',
    resolution: () => 'auto',
  });

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
    const { session, readopt: move, report } = setup();
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
    const { session, readopt: move, taskFailed, report } = setup();
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
