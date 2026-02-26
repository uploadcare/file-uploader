import { defineComponents } from '../abstract/defineComponents';
import type { UploaderPlugin } from '../abstract/managers/plugin';
import { ACTIVITY_TYPES } from '../lit/activity-constants';

const loadUrlSourceModule = async () => {
  const { UrlSource } = await import('../blocks/UrlSource/UrlSource');
  defineComponents({ UrlSource });
};

export const urlSourcePlugin: UploaderPlugin = {
  id: 'url-source',
  setup: async ({ pluginApi, uploaderApi }) => {
    await loadUrlSourceModule();

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
