import { describe, expect, it } from 'vitest';
import { photoSettingsFor } from '../photoCapture';

const caps = (maxWidth: number, maxHeight: number) => ({
  imageWidth: { max: maxWidth },
  imageHeight: { max: maxHeight },
});

describe('photoSettingsFor', () => {
  it('keeps the camera shape at the requested short side', () => {
    expect(photoSettingsFor({ width: 1280, height: 720, resolution: '1080p', capabilities: caps(4032, 3024) })).toEqual(
      { imageWidth: 1920, imageHeight: 1080 },
    );
  });

  it('asks for a 1080 short side for auto', () => {
    expect(photoSettingsFor({ width: 640, height: 480, resolution: 'auto', capabilities: caps(4032, 3024) })).toEqual({
      imageWidth: 1440,
      imageHeight: 1080,
    });
  });

  it('can ask for less than the frame when a lower resolution is set', () => {
    expect(photoSettingsFor({ width: 1920, height: 1080, resolution: '720p', capabilities: caps(4032, 3024) })).toEqual(
      { imageWidth: 1280, imageHeight: 720 },
    );
  });

  it('caps the size at what the camera reports, keeping the shape', () => {
    expect(photoSettingsFor({ width: 1920, height: 1080, resolution: '4k', capabilities: caps(2560, 1920) })).toEqual({
      imageWidth: 2560,
      imageHeight: 1440,
    });
  });

  it('works for a portrait camera', () => {
    expect(photoSettingsFor({ width: 1080, height: 1920, resolution: '720p', capabilities: caps(3024, 4032) })).toEqual(
      { imageWidth: 720, imageHeight: 1280 },
    );
  });

  it('leaves the size to the camera when it reports no limits', () => {
    expect(photoSettingsFor({ width: 1280, height: 720, resolution: '1080p', capabilities: {} })).toBeUndefined();
  });
});
