import { defineComponents } from '../abstract/defineComponents';
import type { UploaderPlugin } from '../abstract/managers/plugin/index';
import { UrlSource } from '../blocks/UrlSource/UrlSource';
import { ACTIVITY_TYPES } from '../lit/activity-constants';
import { UploadSource } from '../utils/UploadSource';

export const urlSourcePlugin: UploaderPlugin = {
  id: 'url-source',
  setup: async ({ pluginApi, uploaderApi }) => {
    defineComponents({ UrlSource });

    pluginApi.registry.registerActivity({
      id: ACTIVITY_TYPES.URL,
      render: (host) => {
        const el = document.createElement('uc-url-source');
        host.append(el);
        return () => {
          host.replaceChildren();
        };
      },
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
