import type { LegacyUploaderPlugin as UploaderPlugin } from '../abstract/plugin-types-legacy';

export const instagramPlugin: UploaderPlugin = {
  id: 'instagram',
  setup({ pluginApi }) {
    pluginApi.registry.registerSource({
      id: 'instagram',
      label: 'src-type-instagram',
      icon: 'instagram',
      expand: () => {
        console.error(
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
