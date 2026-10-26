import { describe, expect, it } from 'vitest';
import {
  filterQualityOptions,
  maxShortSideOf,
  parseAspectRatioOptions,
  parseQualityOptions,
  pickInitial,
} from '../cameraSettings';

describe('parseAspectRatioOptions', () => {
  it('keeps the order and the native keyword', () => {
    expect(parseAspectRatioOptions('native, 1:1, 4:3')).toEqual(['native', '1:1', '4:3']);
  });

  it('drops repeats, including other spellings of the same ratio', () => {
    expect(parseAspectRatioOptions('16:9, 16 : 9, 32:18, 1:1, native, native')).toEqual(['16:9', '1:1', 'native']);
  });

  it('skips invalid items', () => {
    expect(parseAspectRatioOptions('1:1, wide, 4:3')).toEqual(['1:1', '4:3']);
  });

  it('is empty for an empty list', () => {
    expect(parseAspectRatioOptions('')).toEqual([]);
  });
});

describe('parseQualityOptions', () => {
  it('keeps known presets in order, without repeats', () => {
    expect(parseQualityOptions('1080p, auto, 720p, 1080p, 8k')).toEqual(['1080p', 'auto', '720p']);
  });
});

describe('filterQualityOptions', () => {
  it('leaves out presets above the camera maximum, never auto', () => {
    expect(filterQualityOptions(['auto', '720p', '1080p', '4k'], 1080)).toEqual(['auto', '720p', '1080p']);
    expect(filterQualityOptions(['auto', '720p'], 480)).toEqual(['auto']);
  });

  it('keeps everything without a known maximum', () => {
    expect(filterQualityOptions(['720p', '4k'], null)).toEqual(['720p', '4k']);
  });
});

describe('maxShortSideOf', () => {
  const track = (capabilities: MediaTrackCapabilities | undefined) =>
    ({ getCapabilities: capabilities && (() => capabilities) }) as unknown as MediaStreamTrack;

  it('takes the smaller of the max width and height', () => {
    expect(maxShortSideOf(track({ width: { max: 1920 }, height: { max: 1080 } }))).toBe(1080);
  });

  it('is unknown without capabilities', () => {
    expect(maxShortSideOf(track(undefined))).toBeNull();
    expect(maxShortSideOf(track({}))).toBeNull();
    expect(maxShortSideOf(undefined)).toBeNull();
  });
});

describe('pickInitial', () => {
  it('starts on the configured value when it is listed', () => {
    expect(pickInitial(['a', 'b'], (o) => o === 'b')).toEqual({ value: 'b', listed: true });
  });

  it('starts on the first option otherwise', () => {
    expect(pickInitial(['a', 'b'], (o) => o === 'c')).toEqual({ value: 'a', listed: false });
  });
});
