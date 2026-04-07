import { defineComponents } from '../abstract/defineComponents';
import type { UploaderPlugin } from '../abstract/managers/plugin';
import { CameraSource } from '../blocks/CameraSource/CameraSource';
import { ACTIVITY_TYPES } from '../lit/activity-constants';
import { browserFeatures } from '../utils/browser-info';
import { deserializeCsv } from '../utils/comma-separated';

export const cameraPlugin: UploaderPlugin = {
  id: 'camera',
  setup: async ({ pluginApi, uploaderApi }) => {
    defineComponents({ CameraSource });

    // Desktop camera source — opens the camera activity.
    // On mobile devices with htmlMediaCapture, expands to separate photo/video sources.
    pluginApi.registry.registerSource({
      id: 'camera',
      label: 'src-type-camera',
      icon: 'camera',
      expand: () => {
        if (!browserFeatures.htmlMediaCapture) {
          return ['camera'];
        }
        const modes = deserializeCsv(pluginApi.config.get('cameraModes'));
        return modes.length ? modes.map((mode) => `mobile-${mode}-camera`) : ['mobile-photo-camera'];
      },
      onSelect: () => {
        uploaderApi.setCurrentActivity(ACTIVITY_TYPES.CAMERA);
        uploaderApi.setModalState(true);
      },
    });

    // Mobile sources — expanded from 'camera' on devices with htmlMediaCapture
    pluginApi.registry.registerSource({
      id: 'mobile-photo-camera',
      label: 'src-type-mobile-photo-camera',
      icon: 'camera',
      onSelect: () => {
        uploaderApi.openSystemDialog({ captureCamera: true, modeCamera: 'photo' });
      },
    });

    pluginApi.registry.registerSource({
      id: 'mobile-video-camera',
      label: 'src-type-mobile-video-camera',
      icon: 'camera',
      onSelect: () => {
        uploaderApi.openSystemDialog({ captureCamera: true, modeCamera: 'video' });
      },
    });

    pluginApi.registry.registerActivity({
      id: ACTIVITY_TYPES.CAMERA,
      render: (host) => {
        const cameraEl = document.createElement('uc-camera-source');
        host.append(cameraEl);
        return () => {
          host.replaceChildren();
        };
      },
    });
  },
};
