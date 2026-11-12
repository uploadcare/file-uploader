import { describe, expect, it } from 'vitest';
import { CaptureSettings, type CaptureSettingsConfig } from './CaptureSettings';

const settings = (config: Partial<CaptureSettingsConfig> = {}) =>
  new CaptureSettings({
    aspectRatio: () => '',
    resolution: () => 'auto',
    audioQuality: () => 'auto',
    audioMode: () => 'voice',
    ...config,
  });

describe('CaptureSettings', () => {
  it('a pick wins over the first listed value', () => {
    const capture = settings({ aspectRatio: () => '16:9, 4:3', audioQuality: () => 'low, high' });
    expect(capture.aspectRatioChoice).toBe('16:9');

    capture.pick('aspectRatio', '4:3');
    capture.pick('audioQuality', 'high');

    expect(capture.aspectRatioChoice).toBe('4:3');
    expect(capture.aspectRatio).toBeCloseTo(4 / 3);
    expect(capture.audioQuality).toBe('high');
  });

  it('reset gives way to the first listed value', () => {
    const capture = settings({ audioMode: () => 'voice, music' });
    capture.pick('audioMode', 'music');

    capture.reset('audioMode');

    expect(capture.audioMode).toBe('voice');
  });

  it("cameraOpened drops a resolution the camera can't do", () => {
    const capture = settings({ resolution: () => 'auto, 720p, 1080p' });
    capture.pick('resolution', '1080p');

    capture.cameraOpened(720);

    expect(capture.maxShortSide).toBe(720);
    expect(capture.resolutionOptions).toEqual(['auto', '720p']);
    expect(capture.resolution).toBe('auto');
  });

  it("telemetry reports '' for the native ratio", () => {
    expect(settings({ aspectRatio: () => 'native, 16:9' }).telemetry()).toEqual({
      aspectRatio: '',
      resolution: 'auto',
      audioQuality: 'auto',
      audioMode: 'voice',
    });
    expect(settings({ aspectRatio: () => '16:9' }).telemetry().aspectRatio).toBe('16:9');
  });
});
