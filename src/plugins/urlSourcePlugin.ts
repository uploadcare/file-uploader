import type { UploaderPlugin } from '../abstract/managers/plugin';
import { PACKAGE_VERSION } from '../env';
import { UploadSource } from '../utils/UploadSource';
import { defineComponents } from '../abstract/defineComponents';

const URL_ACTIVITY_ID = UploadSource.URL;

export const urlSourcePlugin: UploaderPlugin = {
  id: UploadSource.URL,
  version: PACKAGE_VERSION,
  setup: async ({ pluginApi, uploaderApi }) => {
    const { registry } = pluginApi;

    const { UrlSource } = await import('../blocks/UrlSource/UrlSource');
    defineComponents({ UrlSource });

    registry.registerActivity({
      id: URL_ACTIVITY_ID,
      icon: URL_ACTIVITY_ID,
      render: (host) => {
        const urlSource = document.createElement('uc-url-source');
        host.replaceChildren(urlSource);
        return () => host.replaceChildren();
      },
    });

    registry.registerSource({
      id: URL_ACTIVITY_ID,
      label: 'src-type-from-url',
      icon: URL_ACTIVITY_ID,
      onSelect: () => {
        uploaderApi.setCurrentActivity(URL_ACTIVITY_ID);
        uploaderApi.setModalState(true);
      },
    });
  },
};
