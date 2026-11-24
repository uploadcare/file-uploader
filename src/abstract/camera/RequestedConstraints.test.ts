import { describe, expect, it } from 'vitest';
import { RequestedConstraints } from './RequestedConstraints';

const opened = (constraints: MediaStreamConstraints) => {
  const requested = new RequestedConstraints();
  requested.opened(constraints);
  return requested;
};

describe('RequestedConstraints', () => {
  it('requestVideo is false for the same request', () => {
    const requested = opened({ video: { width: 640 }, audio: false });
    expect(requested.requestVideo({ width: 640 })).toBe(false);
    expect(requested.requestVideo({ width: 1280 })).toBe(true);
    expect(requested.requestVideo({ width: 1280 })).toBe(false);
  });

  it('requestAudio returns the previous record', () => {
    const requested = opened({ video: {}, audio: { channelCount: 1 } });
    expect(requested.requestAudio({ channelCount: 1 })).toBeUndefined();
    expect(requested.requestAudio(false)).toBeUndefined();
    expect(requested.requestAudio({ channelCount: 2 })).toEqual({ previous: '{"channelCount":1}' });
    expect(requested.requestAudio({ channelCount: 2 })).toBeUndefined();
  });

  it('deferAudio(previous) restores it', () => {
    const requested = opened({ video: {}, audio: { channelCount: 1 } });
    const swap = requested.requestAudio({ channelCount: 2 });
    requested.deferAudio(swap);
    expect(requested.flush()).toEqual({ video: false, audio: true });
    // Restored: the same request counts as a change again, and the one before it as none.
    expect(requested.requestAudio({ channelCount: 1 })).toBeUndefined();
    expect(requested.requestAudio({ channelCount: 2 })).toEqual({ previous: '{"channelCount":1}' });
  });

  it('syncDevices rewrites only a matching device in use', () => {
    const requested = opened({ video: { width: 640 }, audio: { channelCount: 1 } });
    const next = {
      video: { width: 640, deviceId: { exact: 'cam' } },
      audio: { channelCount: 1, deviceId: { exact: 'mic' } },
    };
    // Not the device in use: left alone.
    requested.syncDevices(next, { cameraId: 'other', microphoneId: 'mic' }, { cameraId: 'cam', microphoneId: 'other' });
    expect(requested.requestVideo(next.video)).toBe(true);
    expect(requested.requestAudio(next.audio)).toEqual({ previous: '{"channelCount":1}' });

    const fresh = opened({ video: { width: 640 }, audio: { channelCount: 1 } });
    fresh.syncDevices(next, { cameraId: 'cam', microphoneId: 'mic' }, { cameraId: 'cam', microphoneId: 'mic' });
    expect(fresh.requestVideo(next.video)).toBe(false);
    expect(fresh.requestAudio(next.audio)).toBeUndefined();

    // Something besides the device changed: not the same request.
    const changed = opened({ video: { width: 640 }, audio: { channelCount: 1 } });
    changed.syncDevices(
      { video: { width: 1280, deviceId: { exact: 'cam' } }, audio: { channelCount: 2, deviceId: { exact: 'mic' } } },
      { cameraId: 'cam', microphoneId: 'mic' },
      { cameraId: 'cam', microphoneId: 'mic' },
    );
    expect(changed.requestVideo({ width: 640 })).toBe(false);
    expect(changed.requestAudio({ channelCount: 1 })).toBeUndefined();
  });

  it('flush clears both flags', () => {
    const requested = new RequestedConstraints();
    requested.deferVideo();
    requested.deferAudio();
    expect(requested.flush()).toEqual({ video: true, audio: true });
    expect(requested.flush()).toEqual({ video: false, audio: false });
    requested.deferVideo();
    requested.clearPending();
    expect(requested.flush()).toEqual({ video: false, audio: false });
  });
});
