import { describe, expect, it } from 'vitest';
import { photoSettingsFor } from '../photoCapture';

const caps = (maxWidth: number, maxHeight: number) => ({
  imageWidth: { max: maxWidth },
  imageHeight: { max: maxHeight },
});

describe('photoSettingsFor', () => {
  it('asks for the size the stream runs at', () => {
    expect(photoSettingsFor({ width: 1280, height: 720, capabilities: caps(4032, 3024) })).toEqual({
      imageWidth: 1280,
      imageHeight: 720,
    });
  });

  it('works for a portrait stream', () => {
    expect(photoSettingsFor({ width: 1080, height: 1920, capabilities: caps(3024, 4032) })).toEqual({
      imageWidth: 1080,
      imageHeight: 1920,
    });
  });

  it('leaves the size to the camera when the stream is outside its photo range', () => {
    // Any other size would make the camera switch modes, which is what asking for the stream size avoids.
    expect(photoSettingsFor({ width: 3840, height: 2160, capabilities: caps(1920, 1080) })).toBeUndefined();
    expect(
      photoSettingsFor({
        width: 160,
        height: 120,
        capabilities: { imageWidth: { min: 320, max: 1920 }, imageHeight: { min: 240, max: 1080 } },
      }),
    ).toBeUndefined();
  });

  it('leaves the size to the camera when it reports no limits', () => {
    expect(photoSettingsFor({ width: 1280, height: 720, capabilities: {} })).toBeUndefined();
  });
});
