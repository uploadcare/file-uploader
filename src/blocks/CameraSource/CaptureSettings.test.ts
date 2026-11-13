import { describe, expect, it } from 'vitest';
import type { ConfigType } from '../../types/exported';
import { cameraConfig } from './__tests__/camera-fixtures';
import { CaptureSettings } from './CaptureSettings';

const settings = (options: Partial<ConfigType> = {}) =>
  new CaptureSettings(cameraConfig({ cameraAspectRatio: '', cameraResolution: 'auto', ...options }));

describe('CaptureSettings', () => {
  it('a pick wins over the first listed value', () => {
    const capture = settings({ cameraAspectRatio: '16:9, 4:3', cameraAudioQuality: 'low, high' });
    expect(capture.aspectRatioChoice).toBe('16:9');

    capture.pick('aspectRatio', '4:3');
    capture.pick('audioQuality', 'high');

    expect(capture.aspectRatioChoice).toBe('4:3');
    expect(capture.aspectRatio).toBeCloseTo(4 / 3);
    expect(capture.audioQuality).toBe('high');
  });

  it('ignores a pick that is not one of the options offered', () => {
    const capture = settings({
      cameraAspectRatio: '16:9, 4:3',
      cameraResolution: '720p, 1080p',
      cameraAudioQuality: 'low, high',
      cameraAudioMode: 'voice, music',
    });
    capture.pick('resolution', '1080p');

    capture.pick('aspectRatio', '1:1');
    capture.pick('resolution', 'bogus');
    capture.pick('audioQuality', '720p');
    capture.pick('audioMode', '4:3');

    expect(capture.aspectRatioChoice).toBe('16:9');
    expect(capture.resolution).toBe('1080p');
    expect(capture.audioQuality).toBe('low');
    expect(capture.audioMode).toBe('voice');
  });

  it('reset gives way to the first listed value', () => {
    const capture = settings({ cameraAudioMode: 'voice, music' });
    capture.pick('audioMode', 'music');

    capture.reset('audioMode');

    expect(capture.audioMode).toBe('voice');
  });

  it("cameraOpened drops a resolution the camera can't do", () => {
    const capture = settings({ cameraResolution: 'auto, 720p, 1080p' });
    capture.pick('resolution', '1080p');

    capture.cameraOpened(720);

    expect(capture.maxShortSide).toBe(720);
    expect(capture.resolutionOptions).toEqual(['auto', '720p']);
    expect(capture.resolution).toBe('auto');
  });

  it("telemetry reports '' for the native ratio", () => {
    expect(settings({ cameraAspectRatio: 'native, 16:9' }).telemetry()).toEqual({
      aspectRatio: '',
      resolution: 'auto',
      audioQuality: 'auto',
      audioMode: 'voice',
    });
    expect(settings({ cameraAspectRatio: '16:9' }).telemetry().aspectRatio).toBe('16:9');
  });
});
