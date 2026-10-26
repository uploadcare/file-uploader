import { ACTIVITY_TYPES } from '../abstract/activity-constants';
import { defineComponents } from '../abstract/defineComponents';
import type { UploaderPlugin } from '../abstract/managers/plugin/index';
import { ExternalSource } from '../blocks/ExternalSource/ExternalSource';
import { ExternalUploadSource, sourceLabelKey } from '../utils/UploadSource';
import { renderElement } from './renderElement';

export const externalSourcesPlugin: UploaderPlugin = {
  id: 'external-sources',
  setup: async ({ pluginApi, uploaderApi }) => {
    defineComponents({ ExternalSource });

    pluginApi.registry.registerActivity({
      id: ACTIVITY_TYPES.EXTERNAL,
      label: ({ externalSourceType }) => (externalSourceType ? sourceLabelKey(externalSourceType) : ''),
      render: renderElement('uc-external-source'),
    });

    for (const sourceId of Object.values(ExternalUploadSource)) {
      pluginApi.registry.registerSource({
        id: sourceId,
        label: sourceLabelKey(sourceId),
        icon: sourceId,
        onSelect: () => {
          uploaderApi.navigate(ACTIVITY_TYPES.EXTERNAL, { externalSourceType: sourceId });
        },
      });
    }
  },
};
