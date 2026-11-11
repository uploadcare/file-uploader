import { afterEach, describe, expect, it, vi } from 'vitest';
import { Lifetime } from '../../../abstract/di/Lifetime';
import type { CameraLifetime } from '../CameraSession';
import { MicrophoneSwap, type SwapGate } from './MicrophoneSwap';

const lifetimeOf = (lifetime = new Lifetime()): CameraLifetime => ({
  whileAdopted: (work, dispose) => lifetime.guard(work, dispose),
  runTask: (task) => lifetime.run(task, () => {}),
  adoptionSignal: () => lifetime.signal,
});

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

const openGate = (): SwapGate => ({ isCurrent: () => true, isRecording: () => false });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('MicrophoneSwap', () => {
  it('stale when a newer swap started', async () => {
    const calls = stubGetUserMedia();
    const swap = new MicrophoneSwap(lifetimeOf(), vi.fn());
    const commit = vi.fn();
    const older = swap.open({}, openGate(), commit);
    const newer = swap.open({}, openGate(), commit);
    const late = fakeTrack();
    calls[0]?.resolve(microphone(late));

    await expect(older).resolves.toBe('stale');
    expect(late.stop).toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
    const current = fakeTrack();
    calls[1]?.resolve(microphone(current));
    await expect(newer).resolves.toBe('swapped');
    expect(commit).toHaveBeenCalledWith(current);
  });

  it('deferred when recording started meanwhile, tracks stopped', async () => {
    const calls = stubGetUserMedia();
    const swap = new MicrophoneSwap(lifetimeOf(), vi.fn());
    const commit = vi.fn();
    let recording = false;
    const result = swap.open({}, { isCurrent: () => true, isRecording: () => recording }, commit);
    recording = true;
    const track = fakeTrack();
    calls[0]?.resolve(microphone(track));

    await expect(result).resolves.toBe('deferred');
    expect(track.stop).toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
  });

  it('commit runs synchronously with the check', async () => {
    const calls = stubGetUserMedia();
    const swap = new MicrophoneSwap(lifetimeOf(), vi.fn());
    const order: string[] = [];
    const gate: SwapGate = {
      isCurrent: () => {
        order.push('isCurrent');
        queueMicrotask(() => order.push('microtask'));
        return true;
      },
      isRecording: () => {
        order.push('isRecording');
        return false;
      },
    };
    const result = swap.open({}, gate, () => order.push('commit'));
    calls[0]?.resolve(microphone());

    await expect(result).resolves.toBe('swapped');
    expect(order).toEqual(['isCurrent', 'isRecording', 'commit', 'microtask']);
  });

  it('failed reports and keeps going', async () => {
    const calls = stubGetUserMedia();
    const report = vi.fn();
    const swap = new MicrophoneSwap(lifetimeOf(), report);
    const error = new DOMException('Simulated', 'NotReadableError');
    const result = swap.open({}, openGate(), vi.fn());
    calls[0]?.reject(error);

    await expect(result).resolves.toBe('failed');
    expect(report).toHaveBeenCalledWith(
      'warn',
      'Failed to apply the microphone settings, keeping the current ones',
      error,
      'camera capturing. Failed to reopen the microphone',
    );
    const next = swap.open({}, openGate(), vi.fn());
    calls[1]?.resolve(microphone());
    await expect(next).resolves.toBe('swapped');
  });

  it('rethrows a failure once the adoption ended, without reporting it', async () => {
    const calls = stubGetUserMedia();
    const lifetime = new Lifetime();
    const report = vi.fn();
    const swap = new MicrophoneSwap(lifetimeOf(lifetime), report);
    const result = swap.open({}, openGate(), vi.fn());
    lifetime.end();
    calls[0]?.reject(new DOMException('Simulated', 'AbortError'));

    await expect(result).rejects.toThrow();
    expect(report).not.toHaveBeenCalled();
  });
});
