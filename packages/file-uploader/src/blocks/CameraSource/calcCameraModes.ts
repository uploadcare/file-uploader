import type { ConfigType } from '../../types/index';
import { deserializeCsv } from '../../utils/comma-separated';
import { CameraSourceTypes } from './constants';

export const calcCameraModes = (
  cfg: ConfigType,
): {
  isVideoRecordingEnabled: boolean;
  isPhotoEnabled: boolean;
} => ({
  isVideoRecordingEnabled: deserializeCsv(cfg.cameraModes).includes(CameraSourceTypes.VIDEO),
  isPhotoEnabled: deserializeCsv(cfg.cameraModes).includes(CameraSourceTypes.PHOTO),
});
