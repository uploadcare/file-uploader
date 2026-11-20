import { ACTIVITY_TYPES } from '../abstract/activity-constants';
import { defineComponents } from '../abstract/defineComponents';
import type { UploaderPlugin } from '../abstract/managers/plugin/index';
import { UrlSource } from '../blocks/UrlSource/UrlSource';
import { UploadSource } from '../utils/UploadSource';
import { renderElement } from './renderElement';

export const urlSourcePlugin: UploaderPlugin = {
  id: 'url-source',
  setup: async ({ pluginApi, uploaderApi }) => {
    defineComponents({ UrlSource });

    pluginApi.registry.registerActivity({
      id: ACTIVITY_TYPES.URL,
      label: 'caption-from-url',
      render: renderElement('uc-url-source'),
    });

    pluginApi.registry.registerSource({
      id: UploadSource.URL,
      label: 'src-type-from-url',
      icon: 'url',
      onSelect: () => {
        uploaderApi.navigate(ACTIVITY_TYPES.URL);
      },
    });
  },
};
