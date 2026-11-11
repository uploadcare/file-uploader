import { afterEach, describe, expect, it, vi } from 'vitest';
import { Lifetime } from '../../../abstract/di/Lifetime';
import { lifetimeOf } from '../__tests__/camera-fixtures';
import { MicrophoneSwap } from './MicrophoneSwap';

const fakeTrack = () => ({ kind: 'audio', enabled: true, stop: vi.fn() });
const microphone = (track = fakeTrack()) =>
  ({ getTracks: () => [track], getAudioTracks: () => [track] }) as unknown as MediaStream;

/** Each `getUserMedia` call waits until its `answer`. */
const stubGetUserMedia = () => {
  const calls: PromiseWithResolvers<MediaStream>[] = [];
  vi.stubGlobal('navigator', {
    ...navigator,
    mediaDevices: {
      getUserMedia: vi.fn(() => {
        const call = Promise.withResolvers<MediaStream>();
        calls.push(call);
        return call.promise;
      }),
    },
  });
  return calls;
};

const current = () => true;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('MicrophoneSwap', () => {
  it('stale when a newer swap started', async () => {
    const calls = stubGetUserMedia();
    const swap = new MicrophoneSwap(lifetimeOf(), vi.fn());
    const older = swap.open({}, current);
    const newer = swap.open({}, current);
    const late = fakeTrack();
    calls[0]?.resolve(microphone(late));

    await expect(older).resolves.toBeNull();
    expect(late.stop).toHaveBeenCalled();
    const latest = fakeTrack();
    calls[1]?.resolve(microphone(latest));
    await expect(newer).resolves.toBe(latest);
    expect(latest.stop).not.toHaveBeenCalled();
  });

  it('stale when isCurrent no longer wants it once it opened, tracks stopped', async () => {
    const calls = stubGetUserMedia();
    const swap = new MicrophoneSwap(lifetimeOf(), vi.fn());
    let wanted = true;
    const result = swap.open({}, () => wanted);
    wanted = false;
    const track = fakeTrack();
    calls[0]?.resolve(microphone(track));

    await expect(result).resolves.toBeNull();
    expect(track.stop).toHaveBeenCalled();
  });

  it('failed reports and keeps going', async () => {
    const calls = stubGetUserMedia();
    const report = vi.fn();
    const swap = new MicrophoneSwap(lifetimeOf(), report);
    const error = new DOMException('Simulated', 'NotReadableError');
    const result = swap.open({}, current);
    calls[0]?.reject(error);

    await expect(result).resolves.toBeNull();
    expect(report).toHaveBeenCalledWith(
      'warn',
      'Failed to apply the microphone settings, keeping the current ones',
      error,
      'camera capturing. Failed to reopen the microphone',
    );
    const next = swap.open({}, current);
    const track = fakeTrack();
    calls[1]?.resolve(microphone(track));
    await expect(next).resolves.toBe(track);
  });

  it('rethrows a failure once the adoption ended, without reporting it', async () => {
    const calls = stubGetUserMedia();
    const lifetime = new Lifetime();
    const report = vi.fn();
    const swap = new MicrophoneSwap(lifetimeOf(lifetime), report);
    const result = swap.open({}, current);
    lifetime.end();
    calls[0]?.reject(new DOMException('Simulated', 'AbortError'));

    await expect(result).rejects.toThrow();
    expect(report).not.toHaveBeenCalled();
  });
});
