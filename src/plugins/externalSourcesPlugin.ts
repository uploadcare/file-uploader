import { defineComponents } from '../abstract/defineComponents';
import type { UploaderPlugin } from '../abstract/managers/plugin';
import { ACTIVITY_TYPES } from '../lit/activity-constants';
import { ExternalUploadSource } from '../utils/UploadSource';

const loadExternalSourceModule = async () => {
  const { ExternalSource } = await import('../blocks/ExternalSource/ExternalSource');
  defineComponents({ ExternalSource });
};

export const externalSourcesPlugin: UploaderPlugin = {
  id: 'external-sources',
  setup: async ({ pluginApi, uploaderApi }) => {
    await loadExternalSourceModule();

    pluginApi.registry.registerActivity({
      id: ACTIVITY_TYPES.EXTERNAL,
      render: (host) => {
        const el = document.createElement('uc-external-source');
        host.append(el);
        return () => {
          host.replaceChildren();
        };
      },
    });

    for (const sourceId of Object.values(ExternalUploadSource)) {
      pluginApi.registry.registerSource({
        id: sourceId,
        label: `src-type-${sourceId}`,
        icon: sourceId,
        onSelect: () => {
          uploaderApi.setCurrentActivity(ACTIVITY_TYPES.EXTERNAL, { externalSourceType: sourceId });
          uploaderApi.setModalState(true);
        },
      });
    }
  },
};
