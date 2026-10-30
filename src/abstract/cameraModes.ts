import type { ConfigType } from '../types/index';
import { deserializeCsv } from '../utils/comma-separated';

export const CameraSourceTypes = Object.freeze({
  PHOTO: 'photo',
  VIDEO: 'video',
});

export type ModeCameraType = (typeof CameraSourceTypes)[keyof typeof CameraSourceTypes];

export type CameraMode = ModeCameraType;

/** The known modes in a `cameraModes` value, in the order given. */
export const parseCameraModes = (cameraModes: string): CameraMode[] =>
  deserializeCsv(cameraModes).filter(
    (mode): mode is CameraMode => mode === CameraSourceTypes.PHOTO || mode === CameraSourceTypes.VIDEO,
  );

export const calcCameraModes = (
  cfg: ConfigType,
): {
  isVideoRecordingEnabled: boolean;
  isPhotoEnabled: boolean;
} => {
  const modes = parseCameraModes(cfg.cameraModes);
  return {
    isVideoRecordingEnabled: modes.includes(CameraSourceTypes.VIDEO),
    isPhotoEnabled: modes.includes(CameraSourceTypes.PHOTO),
  };
};
