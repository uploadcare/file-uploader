import type { UploaderPlugin } from '../abstract/managers/plugin';
import { UploadSource } from '../utils/UploadSource';

export const localSourcePlugin: UploaderPlugin = {
  id: UploadSource.LOCAL,
  setup: ({ pluginApi, uploaderApi }) => {
    pluginApi.registry.registerSource({
      id: UploadSource.LOCAL,
      label: 'src-type-local',
      icon: 'local',
      onSelect: () => {
        uploaderApi.openSystemDialog();
      },
    });
  },
};
