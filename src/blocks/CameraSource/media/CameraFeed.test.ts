import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BuildConstraintsInput } from '../../../abstract/camera/buildConstraints';
import { Lifetime } from '../../../abstract/di/Lifetime';
import type { CameraLifetime } from '../CameraSession';
import { CameraFeed } from './CameraFeed';

const lifetimeOf = (lifetime = new Lifetime()): CameraLifetime => ({
  whileAdopted: (work, dispose) => lifetime.guard(work, dispose),
  runTask: (task) => lifetime.run(task, () => {}),
  adoptionSignal: () => lifetime.signal,
});

const fakeTrack = (kind: 'audio' | 'video') => ({ kind, enabled: true, stop: vi.fn() });
type FakeTrack = ReturnType<typeof fakeTrack>;

const fakeStream = (tracks: FakeTrack[]) =>
  ({
    getTracks: () => [...tracks],
    getVideoTracks: () => tracks.filter((t) => t.kind === 'video'),
    getAudioTracks: () => tracks.filter((t) => t.kind === 'audio'),
    addTrack: (t: FakeTrack) => tracks.push(t),
    removeTrack: (t: FakeTrack) => tracks.splice(tracks.indexOf(t), 1),
  }) as unknown as MediaStream;

const stubGetUserMedia = (impl: (constraints: MediaStreamConstraints) => Promise<MediaStream>) => {
  const getUserMedia = vi.fn(impl);
  vi.stubGlobal('navigator', { ...navigator, mediaDevices: { getUserMedia } });
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

    expect(feed.close()).toBe(true);
    expect(video.stop).toHaveBeenCalled();
    expect(feed.stream).toBeNull();
    expect(feed.close()).toBe(false);
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
