import { describe, expect, it } from 'vitest';
import type { ConfigType } from '../../../types/index';
import { initialConfig } from '../../Config/initialConfig';
import { calcCameraModes } from '../calcCameraModes';

describe('calcCameraModes', () => {
  it('should return both modes enabled when cameraModes includes video and photo', () => {
    const cfg = { ...initialConfig } as ConfigType;
    const result = calcCameraModes(cfg);
    expect(result).toEqual({
      isVideoRecordingEnabled: true,
      isPhotoEnabled: true,
    });
  });

  it('should return only video enabled when cameraModes includes only video', () => {
    const cfg = { ...initialConfig, cameraModes: 'video' } as ConfigType;
    const result = calcCameraModes(cfg);
    expect(result).toEqual({
      isVideoRecordingEnabled: true,
      isPhotoEnabled: false,
    });
  });

  it('should return only photo enabled when cameraModes includes only photo', () => {
    const cfg = { ...initialConfig, cameraModes: 'photo' } as ConfigType;
    const result = calcCameraModes(cfg);
    expect(result).toEqual({
      isVideoRecordingEnabled: false,
      isPhotoEnabled: true,
    });
  });

  it('should return both modes disabled when cameraModes is empty', () => {
    const cfg = { ...initialConfig, cameraModes: '' } as ConfigType;
    const result = calcCameraModes(cfg);
    expect(result).toEqual({
      isVideoRecordingEnabled: false,
      isPhotoEnabled: false,
    });
  });

  it('should handle mixed valid and invalid values', () => {
    const cfg = { cameraModes: 'video,unknown,photo' } as ConfigType;
    const result = calcCameraModes(cfg);
    expect(result).toEqual({
      isVideoRecordingEnabled: true,
      isPhotoEnabled: true,
    });
  });
});
