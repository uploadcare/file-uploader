import { describe, expect, it, vi } from 'vitest';
import {
  AUDIO_MODE_CONSTRAINTS,
  audioBitsPerSecond,
  type BuildConstraintsInput,
  buildConstraints,
  DEFAULT_VIDEO_CONSTRAINTS,
  qualityResolution,
} from '../buildConstraints';

const input = (overrides: Partial<BuildConstraintsInput> = {}): BuildConstraintsInput => ({
  mode: 'photo',
  enableAudio: false,
  audioMode: 'voice',
  aspectRatio: null,
  quality: 'auto',
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

  it('asks for the aspect ratio as ideal, with a resolution in that shape', () => {
    expect(buildConstraints(input({ aspectRatio: 1 })).video).toEqual({
      ...DEFAULT_VIDEO_CONSTRAINTS,
      width: { ideal: 1080 },
      height: { ideal: 1080 },
      aspectRatio: { ideal: 1 },
    });
  });

  it('lets a custom aspectRatio replace the configured one', () => {
    const { video } = buildConstraints(input({ aspectRatio: 1, custom: { video: { aspectRatio: { exact: 4 / 3 } } } }));

    expect(video.aspectRatio).toEqual({ exact: 4 / 3 });
  });

  it('replaces the default resolution with the quality preset', () => {
    const { video } = buildConstraints(input({ quality: '720p', aspectRatio: 1 }));

    expect(video).toMatchObject({ width: { ideal: 720 }, height: { ideal: 720 }, aspectRatio: { ideal: 1 } });
  });

  it('lets a custom width replace the quality preset', () => {
    const { video } = buildConstraints(input({ quality: '4k', custom: { video: { width: { ideal: 1000 } } } }));

    expect(video).toMatchObject({ width: { ideal: 1000 }, height: { ideal: 2160 } });
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

describe('qualityResolution', () => {
  it('keeps the defaults for auto without a ratio', () => {
    expect(qualityResolution('auto', null)).toEqual({});
  });

  it('asks for a 1080 short side in the ratio for auto with a ratio', () => {
    expect(qualityResolution('auto', 1)).toEqual({ width: { ideal: 1080 }, height: { ideal: 1080 } });
    expect(qualityResolution('auto', 9 / 16)).toEqual({ width: { ideal: 1080 }, height: { ideal: 1920 } });
  });

  it.each([
    ['720p', null, 1280, 720],
    ['1080p', null, 1920, 1080],
    ['4k', null, 3840, 2160],
    ['1080p', 1, 1080, 1080],
    ['1080p', 4 / 3, 1440, 1080],
    ['1080p', 9 / 16, 1080, 1920],
    ['720p', 3 / 4, 720, 960],
  ] as const)('%s at ratio %s asks for %i×%i', (quality, ratio, width, height) => {
    expect(qualityResolution(quality, ratio)).toEqual({ width: { ideal: width }, height: { ideal: height } });
  });
});

describe('audio mode', () => {
  it('keeps the browser voice defaults', () => {
    expect(buildConstraints(input({ enableAudio: true })).audio).toEqual({});
  });

  it('turns processing off and asks for stereo for music', () => {
    expect(buildConstraints(input({ enableAudio: true, audioMode: 'music' })).audio).toEqual(
      AUDIO_MODE_CONSTRAINTS.music,
    );
  });

  it('lets custom audio constraints and the picked microphone win', () => {
    const { audio } = buildConstraints(
      input({
        enableAudio: true,
        audioMode: 'music',
        audioId: 'mic-1',
        custom: { audio: { noiseSuppression: true, deviceId: 'other' } },
      }),
    );

    expect(audio).toMatchObject({ noiseSuppression: true, channelCount: { ideal: 2 }, deviceId: { exact: 'mic-1' } });
  });

  it('asks for no audio when recording audio is off', () => {
    expect(buildConstraints(input({ audioMode: 'music' })).audio).toBe(false);
  });
});

describe('audioBitsPerSecond', () => {
  it.each([
    ['auto', undefined],
    ['low', 32_000],
    ['standard', 96_000],
    ['high', 192_000],
  ] as const)('%s records at %s bps', (quality, bitrate) => {
    expect(audioBitsPerSecond(null, quality)).toBe(bitrate);
  });

  it('lets an explicit mediaRecorderOptions bitrate win', () => {
    expect(audioBitsPerSecond({ audioBitsPerSecond: 48_000 }, 'high')).toBe(48_000);
    // `bitsPerSecond` covers audio too, so the preset must not override it.
    expect(audioBitsPerSecond({ bitsPerSecond: 2_000_000 }, 'high')).toBeUndefined();
  });
});
