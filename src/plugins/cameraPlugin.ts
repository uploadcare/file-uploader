import { ACTIVITY_TYPES } from '../abstract/activity-constants';
import { defineComponents } from '../abstract/defineComponents';
import type { UploaderPlugin } from '../abstract/managers/plugin/index';
import { CameraSource } from '../blocks/CameraSource/CameraSource';
import { browserFeatures } from '../utils/browser-info';
import { deserializeCsv } from '../utils/comma-separated';
import { UploadSource, UploadSourceMobile } from '../utils/UploadSource';
import { renderElement } from './renderElement';

export const cameraPlugin: UploaderPlugin = {
  id: 'camera',
  setup: async ({ pluginApi, uploaderApi }) => {
    defineComponents({ CameraSource });

    // Desktop camera source — opens the camera activity.
    // On mobile devices with htmlMediaCapture, expands to separate photo/video sources.
    pluginApi.registry.registerSource({
      id: UploadSource.CAMERA,
      label: 'src-type-camera',
      icon: 'camera',
      expand: () => {
        if (!browserFeatures.htmlMediaCapture) {
          return [UploadSource.CAMERA];
        }
        const modes = deserializeCsv(pluginApi.config.get('cameraModes'));
        return modes.length ? modes.map((mode) => `mobile-${mode}-camera`) : [UploadSourceMobile.MOBILE_PHOTO_CAMERA];
      },
      onSelect: () => {
        uploaderApi.navigate(ACTIVITY_TYPES.CAMERA);
      },
    });

    // Mobile sources — expanded from 'camera' on devices with htmlMediaCapture
    pluginApi.registry.registerSource({
      id: UploadSourceMobile.MOBILE_PHOTO_CAMERA,
      label: 'src-type-mobile-photo-camera',
      icon: 'camera',
      onSelect: () => {
        uploaderApi.openSystemDialog({ captureCamera: true, modeCamera: 'photo' });
      },
    });

    pluginApi.registry.registerSource({
      id: UploadSourceMobile.MOBILE_VIDEO_CAMERA,
      label: 'src-type-mobile-video-camera',
      icon: 'video-camera',
      onSelect: () => {
        uploaderApi.openSystemDialog({ captureCamera: true, modeCamera: 'video' });
      },
    });

    pluginApi.registry.registerActivity({
      id: ACTIVITY_TYPES.CAMERA,
      label: 'caption-camera',
      render: renderElement('uc-camera-source'),
    });
  },
};
