import { defineComponents } from '../abstract/defineComponents';
import type { UploaderPlugin } from '../abstract/managers/plugin';
import { UrlSource } from '../blocks/UrlSource/UrlSource';
import { ACTIVITY_TYPES } from '../lit/activity-constants';

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
      id: 'url',
      label: 'src-type-from-url',
      icon: 'url',
      onSelect: () => {
        uploaderApi.setCurrentActivity(ACTIVITY_TYPES.URL);
        uploaderApi.setModalState(true);
      },
    });
  },
};
