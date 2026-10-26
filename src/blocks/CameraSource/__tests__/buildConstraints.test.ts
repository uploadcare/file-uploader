import { describe, expect, it, vi } from 'vitest';
import { type BuildConstraintsInput, buildConstraints, DEFAULT_VIDEO_CONSTRAINTS } from '../buildConstraints';

const input = (overrides: Partial<BuildConstraintsInput> = {}): BuildConstraintsInput => ({
  mode: 'photo',
  enableAudio: false,
  custom: null,
  cameraId: null,
  audioId: null,
  ...overrides,
});

describe('buildConstraints', () => {
  it('uses the defaults and no audio when nothing is set', () => {
    expect(buildConstraints(input())).toEqual({ video: DEFAULT_VIDEO_CONSTRAINTS, audio: false });
  });

  it('keeps the defaults when a camera is picked', () => {
    expect(buildConstraints(input({ cameraId: 'cam-1' })).video).toEqual({
      ...DEFAULT_VIDEO_CONSTRAINTS,
      deviceId: { exact: 'cam-1' },
    });
  });

  it('lets each custom video property replace the default of the same name', () => {
    const { video } = buildConstraints(input({ custom: { video: { width: { min: 1280 }, zoom: 2 } as never } }));

    expect(video).toEqual({ ...DEFAULT_VIDEO_CONSTRAINTS, width: { min: 1280 }, zoom: 2 });
  });

  it('lets the picked devices win over a custom deviceId', () => {
    const constraints = buildConstraints(
      input({
        enableAudio: true,
        cameraId: 'cam-1',
        audioId: 'mic-1',
        custom: { video: { deviceId: 'other-cam' }, audio: { deviceId: 'other-mic' } },
      }),
    );

    expect(constraints.video.deviceId).toEqual({ exact: 'cam-1' });
    expect(constraints.audio).toEqual({ deviceId: { exact: 'mic-1' } });
  });

  it('merges custom audio constraints when audio is enabled', () => {
    const constraints = buildConstraints(input({ enableAudio: true, custom: { audio: { echoCancellation: false } } }));

    expect(constraints.audio).toEqual({ echoCancellation: false });
  });

  it('ignores custom audio constraints when audio is disabled', () => {
    const constraints = buildConstraints(input({ custom: { audio: { echoCancellation: false } } }));

    expect(constraints.audio).toBe(false);
  });

  it('calls the function form with the mode', () => {
    const custom = vi.fn(({ mode }) => ({ video: { frameRate: { ideal: mode === 'video' ? 60 : 30 } } }));

    expect(buildConstraints(input({ mode: 'video', custom })).video.frameRate).toEqual({ ideal: 60 });
    expect(custom).toHaveBeenCalledWith({ mode: 'video' });
  });

  it('falls back to the defaults when the function form throws', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const constraints = buildConstraints(
      input({
        custom: () => {
          throw new Error('integrator bug');
        },
      }),
    );

    expect(constraints.video).toEqual(DEFAULT_VIDEO_CONSTRAINTS);
    expect(console.warn).toHaveBeenCalled();
  });
});
