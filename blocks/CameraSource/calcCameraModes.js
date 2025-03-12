//@ts-check

import { deserializeCsv } from '../utils/comma-separated.js';
import { CameraSourceTypes } from './constants.js';

export const calcCameraModes = (/** @type {import('../../types').ConfigType} } */ cfg) => {
  return {
    isVideoRecordingEnabled: deserializeCsv(cfg.cameraModes).includes(CameraSourceTypes.VIDEO),
    isPhotoEnabled: deserializeCsv(cfg.cameraModes).includes(CameraSourceTypes.PHOTO),
  };
};
