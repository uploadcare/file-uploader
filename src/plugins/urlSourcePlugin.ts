import '../blocks/UrlSource/UrlSource';
import { definePlugin } from '../abstract/plugin';

/**
 * URL source plugin. Registers a "From URL" source + a 'url' activity.
 * The activity body is a v2 `<uc-url-source>` block; v1's
 * `url-source.css` styles the tag directly.
 */
export const urlSourcePlugin = definePlugin({
  id: 'url-source',
  setup({ uploader, sources, activities }) {
    void uploader;

    sources.register({
      id: 'url',
      label: 'src-type-from-url',
      icon: 'url',
      onSelect: () => uploader.router.navigate('url'),
    });

    activities.register({
      id: 'url',
      routes: { onFileAdd: 'upload-list', onCancel: 'start-from' },
      render(host) {
        const el = document.createElement('uc-url-source');
        host.append(el);
        return () => host.replaceChildren();
      },
    });
  },
});

/** @deprecated Use `urlSourcePlugin`. Kept as an alias for spike continuity. */
export const urlPlugin = urlSourcePlugin;
