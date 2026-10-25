import type { UploaderPlugin } from '../abstract/managers/plugin';
import { INSTAGRAM_SOURCE } from '../utils/UploadSource';

export const instagramPlugin: UploaderPlugin = {
  id: 'instagram',
  setup({ pluginApi }) {
    pluginApi.registry.registerSource({
      id: INSTAGRAM_SOURCE,
      label: 'src-type-instagram',
      icon: 'instagram',
      expand: () => {
        pluginApi.logger.error(
          "Instagram source was removed because the Instagram Basic Display API hasn't been available since December 4, 2024. " +
            'Official statement, see here: ' +
            'https://developers.facebook.com/blog/post/2024/09/04/update-on-instagram-basic-display-api/?locale=en_US',
        );
        return [];
      },
      onSelect: () => {},
    });
  },
};
