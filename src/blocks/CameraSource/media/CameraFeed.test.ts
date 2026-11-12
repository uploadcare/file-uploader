import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BuildConstraintsInput } from '../../../abstract/camera/buildConstraints';
import { fakeStream, fakeTrack, lifetimeOf } from '../__tests__/camera-fixtures';
import { CameraFeed } from './CameraFeed';

/** `permissions` answers the Permissions API with these states; without it, there is no Permissions API. */
const stubGetUserMedia = (
  impl: (constraints: MediaStreamConstraints) => Promise<MediaStream>,
  permissions?: { camera: PermissionState; microphone: PermissionState },
) => {
  const getUserMedia = vi.fn(impl);
  const query = async ({ name }: { name: 'camera' | 'microphone' }) => ({ state: permissions?.[name] });
  vi.stubGlobal('navigator', {
    ...navigator,
    mediaDevices: { getUserMedia },
    ...(permissions && { permissions: { query } }),
  });
  return getUserMedia;
};

const input = (custom: BuildConstraintsInput['custom'] = null): BuildConstraintsInput => ({
  mode: 'photo',
  enableAudio: true,
  audioMode: 'voice',
  aspectRatio: null,
  resolution: 'auto',
  custom,
  cameraId: null,
  audioId: null,
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CameraFeed', () => {
  it('a superseded open stops its stream and resolves null', async () => {
    const first = Promise.withResolvers<MediaStream>();
    const latest = fakeStream([fakeTrack('video')]);
    stubGetUserMedia(vi.fn().mockReturnValueOnce(first.promise).mockResolvedValueOnce(latest));
    const feed = new CameraFeed(lifetimeOf(), vi.fn());

    const superseded = feed.open(input(), () => {});
    const current = feed.open(input(), () => {});
    await expect(current).resolves.toMatchObject({ stream: latest });
    const late = fakeStream([fakeTrack('video')]);
    first.resolve(late);

    await expect(superseded).resolves.toBeNull();
    expect(late.getVideoTracks()[0]?.stop).toHaveBeenCalled();
    expect(feed.stream).toBe(latest);
  });

  it('an overconstrained custom open retries without it and marks customDropped', async () => {
    const error = new DOMException('Simulated', 'OverconstrainedError');
    const stream = fakeStream([fakeTrack('video')]);
    const getUserMedia = stubGetUserMedia(vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce(stream));
    const report = vi.fn();
    const feed = new CameraFeed(lifetimeOf(), report);

    const beforeAttempt = vi.fn();
    const opened = await feed.open(input({ video: { width: { exact: 9999 } } }), beforeAttempt);

    expect(opened?.stream).toBe(stream);
    expect(getUserMedia.mock.calls[0]?.[0].video).toMatchObject({ width: { exact: 9999 } });
    expect(getUserMedia.mock.calls[1]?.[0].video).not.toMatchObject({ width: { exact: 9999 } });
    expect(opened?.constraints).toBe(getUserMedia.mock.calls[1]?.[0]);
    expect(feed.customDropped).toBe(true);
    expect(beforeAttempt.mock.invocationCallOrder[0]).toBeLessThan(getUserMedia.mock.invocationCallOrder[0] ?? 0);
    expect(beforeAttempt.mock.invocationCallOrder[1]).toBeLessThan(getUserMedia.mock.invocationCallOrder[1] ?? 0);
    expect(beforeAttempt.mock.invocationCallOrder[1]).toBeGreaterThan(getUserMedia.mock.invocationCallOrder[0] ?? 0);
    expect(report).toHaveBeenCalledWith(
      'warn',
      'The camera cannot satisfy cameraConstraints, opening it without them',
      error,
      'camera capturing. cameraConstraints could not be satisfied',
    );
    feed.resetCustomDropped();
    expect(feed.customDropped).toBe(false);
  });

  it('a refused microphone opens the camera once more without it, and hands back the asked constraints', async () => {
    const error = new DOMException('Simulated', 'NotAllowedError');
    const stream = fakeStream([fakeTrack('video')]);
    const getUserMedia = stubGetUserMedia(vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce(stream));
    const report = vi.fn();
    const feed = new CameraFeed(lifetimeOf(), report);
    const beforeAttempt = vi.fn();

    const opened = await feed.open({ ...input(), mode: 'video' }, beforeAttempt);

    expect(opened?.stream).toBe(stream);
    expect(getUserMedia.mock.calls[0]?.[0].audio).toBeTruthy();
    expect(getUserMedia.mock.calls[1]?.[0]).toEqual({ ...getUserMedia.mock.calls[0]?.[0], audio: false });
    expect(opened?.constraints).toBe(getUserMedia.mock.calls[0]?.[0]);
    expect(beforeAttempt).toHaveBeenCalledTimes(2);
    expect(report).toHaveBeenCalledWith(
      'warn',
      'The microphone was refused, opening the camera without it',
      error,
      'camera capturing. Failed to capture camera',
    );
  });

  it('a camera refused without the microphone too rejects with that refusal', async () => {
    const cameraRefused = new DOMException('Camera', 'NotAllowedError');
    const getUserMedia = stubGetUserMedia(
      vi.fn().mockRejectedValueOnce(new DOMException('Both', 'NotAllowedError')).mockRejectedValueOnce(cameraRefused),
    );
    const report = vi.fn();
    const feed = new CameraFeed(lifetimeOf(), report);

    await expect(feed.open({ ...input(), mode: 'video' }, () => {})).rejects.toBe(cameraRefused);
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(report).not.toHaveBeenCalled();
  });

  it('a dismissed prompt is the camera refused: not retried without the microphone', async () => {
    const error = new DOMException('Permission dismissed', 'NotAllowedError');
    const getUserMedia = stubGetUserMedia(vi.fn().mockRejectedValue(error), { camera: 'prompt', microphone: 'prompt' });
    const report = vi.fn();
    const feed = new CameraFeed(lifetimeOf(), report);

    await expect(feed.open({ ...input(), mode: 'video' }, () => {})).rejects.toBe(error);
    expect(getUserMedia).toHaveBeenCalledOnce();
    expect(report).not.toHaveBeenCalled();
  });

  it.each([
    ['the microphone refused, the camera never asked', { camera: 'prompt', microphone: 'denied' }],
    ['the camera granted, the microphone refused', { camera: 'granted', microphone: 'denied' }],
    ['both refused', { camera: 'denied', microphone: 'denied' }],
  ] as const)('a refusal with %s is retried without the microphone', async (_, permissions) => {
    const getUserMedia = stubGetUserMedia(
      vi
        .fn()
        .mockRejectedValueOnce(new DOMException('Simulated', 'NotAllowedError'))
        .mockResolvedValueOnce(fakeStream([fakeTrack('video')])),
      permissions,
    );
    const feed = new CameraFeed(lifetimeOf(), vi.fn());

    await expect(feed.open({ ...input(), mode: 'video' }, () => {})).resolves.toMatchObject({
      microphoneRefused: true,
    });
    expect(getUserMedia).toHaveBeenCalledTimes(2);
  });

  it('a refusal whose permissions answer after a later open began leaves the camera to it', async () => {
    const latest = fakeStream([fakeTrack('video')]);
    const getUserMedia = stubGetUserMedia(
      vi.fn().mockRejectedValueOnce(new DOMException('Simulated', 'NotAllowedError')).mockResolvedValueOnce(latest),
      { camera: 'granted', microphone: 'denied' },
    );
    const answered = Promise.withResolvers<{ state: PermissionState }>();
    const query = vi.fn(() => answered.promise);
    Object.assign(navigator.permissions, { query });
    const feed = new CameraFeed(lifetimeOf(), vi.fn());
    const superseded = feed.open({ ...input(), mode: 'video' }, () => {});
    await vi.waitFor(() => expect(query).toHaveBeenCalled());

    const current = feed.open({ ...input(), enableAudio: false }, () => {});
    answered.resolve({ state: 'denied' });

    await expect(superseded).resolves.toBeNull();
    await expect(current).resolves.toMatchObject({ stream: latest });
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(feed.stream).toBe(latest);
  });

  it('a dismissed prompt whose permissions answer after a later open began gives way to it', async () => {
    const latest = Promise.withResolvers<MediaStream>();
    stubGetUserMedia(
      vi
        .fn()
        .mockRejectedValueOnce(new DOMException('Permission dismissed', 'NotAllowedError'))
        .mockReturnValueOnce(latest.promise),
      { camera: 'prompt', microphone: 'prompt' },
    );
    const answered = Promise.withResolvers<{ state: PermissionState }>();
    const query = vi.fn(() => answered.promise);
    Object.assign(navigator.permissions, { query });
    const feed = new CameraFeed(lifetimeOf(), vi.fn());
    const superseded = feed.open({ ...input(), mode: 'video' }, () => {});
    await vi.waitFor(() => expect(query).toHaveBeenCalled());

    // The newer open is still waiting on the camera when the older one's permissions answer.
    const current = feed.open({ ...input(), enableAudio: false }, () => {});
    answered.resolve({ state: 'prompt' });

    await expect(superseded).resolves.toBeNull();
    const stream = fakeStream([fakeTrack('video')]);
    latest.resolve(stream);
    await expect(current).resolves.toMatchObject({ stream });
  });

  it('a refusal of an open without the microphone is not retried', async () => {
    const error = new DOMException('Simulated', 'NotAllowedError');
    const getUserMedia = stubGetUserMedia(vi.fn().mockRejectedValue(error));
    const feed = new CameraFeed(lifetimeOf(), vi.fn());

    await expect(feed.open({ ...input(), enableAudio: false }, () => {})).rejects.toBe(error);
    expect(getUserMedia).toHaveBeenCalledOnce();
  });

  it('forgets dropped custom constraints when it opens again', async () => {
    const error = new DOMException('Simulated', 'OverconstrainedError');
    const getUserMedia = stubGetUserMedia(
      vi
        .fn()
        .mockRejectedValueOnce(error)
        .mockImplementation(async () => fakeStream([fakeTrack('video')])),
    );
    const feed = new CameraFeed(lifetimeOf(), vi.fn());
    const custom = input({ video: { width: { exact: 9999 } } });
    await feed.open(custom, () => {});
    expect(feed.customDropped).toBe(true);

    await feed.open(custom, () => {});

    expect(getUserMedia.mock.calls[2]?.[0].video).toMatchObject({ width: { exact: 9999 } });
    expect(feed.customDropped).toBe(false);
  });

  it('swapAudioTrack keeps mute', async () => {
    const oldAudio = fakeTrack('audio');
    stubGetUserMedia(async () => fakeStream([fakeTrack('video'), oldAudio]));
    const feed = new CameraFeed(lifetimeOf(), vi.fn());
    await feed.open(input(), () => {});
    feed.toggleAudio();
    expect(feed.audioMuted).toBe(true);

    const newAudio = fakeTrack('audio');
    feed.swapAudioTrack(newAudio as unknown as MediaStreamTrack);

    expect(newAudio.enabled).toBe(false);
    expect(oldAudio.stop).toHaveBeenCalled();
    expect(feed.stream?.getAudioTracks()).toEqual([newAudio]);
    expect(feed.audioMuted).toBe(true);
  });

  it('a new open unmutes, and close stops the tracks once', async () => {
    const video = fakeTrack('video');
    stubGetUserMedia(async () => fakeStream([video, fakeTrack('audio')]));
    const feed = new CameraFeed(lifetimeOf(), vi.fn());
    await feed.open(input(), () => {});
    feed.toggleAudio();
    await feed.open(input(), () => {});
    expect(feed.audioMuted).toBe(false);

    feed.close();
    expect(video.stop).toHaveBeenCalledOnce();
    expect(feed.stream).toBeNull();
    feed.close();
    expect(video.stop).toHaveBeenCalledOnce();
  });

  it("drops a superseded open's failure", async () => {
    const first = Promise.withResolvers<MediaStream>();
    stubGetUserMedia(
      vi
        .fn()
        .mockReturnValueOnce(first.promise)
        .mockResolvedValueOnce(fakeStream([fakeTrack('video')])),
    );
    const feed = new CameraFeed(lifetimeOf(), vi.fn());
    const superseded = feed.open(input(), () => {});
    await feed.open(input(), () => {});
    first.reject(new DOMException('Simulated', 'NotReadableError'));

    await expect(superseded).resolves.toBeNull();
  });

  it('toggleAudio without a microphone leaves audioMuted', async () => {
    stubGetUserMedia(async () => fakeStream([fakeTrack('video')]));
    const feed = new CameraFeed(lifetimeOf(), vi.fn());
    feed.toggleAudio();
    await feed.open(input(), () => {});
    feed.toggleAudio();
    expect(feed.audioMuted).toBe(false);
  });

  it.each([
    [false, 'the camera settings'],
    [true, 'the camera settings or cameraConstraints'],
  ])('applyVideo reports a refused change (custom involved: %s)', async (customInvolved, subject) => {
    const video = { ...fakeTrack('video'), applyConstraints: vi.fn() };
    const error = new DOMException('Simulated', 'OverconstrainedError');
    video.applyConstraints.mockRejectedValue(error);
    stubGetUserMedia(async () => fakeStream([video]));
    const report = vi.fn();
    const feed = new CameraFeed(lifetimeOf(), report);
    await feed.applyVideo({}, customInvolved);
    await feed.open(input(), () => {});

    await feed.applyVideo({ width: 1 }, customInvolved);

    expect(video.applyConstraints).toHaveBeenCalledWith({ width: 1 });
    expect(report).toHaveBeenCalledWith(
      'warn',
      `The camera cannot apply ${subject}, keeping the current ones`,
      error,
      `camera capturing. ${subject} could not be applied`,
    );
  });
});
