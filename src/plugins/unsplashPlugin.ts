import '../blocks/UnsplashSource/UnsplashSource';
import { definePlugin } from '../abstract/plugin';

const DEFAULT_ACCESS_KEY = 'coTRXFIt3uBtv4MRhmSy1-w55dDL0nV2X1ure63W78c';
const UNSPLASH_ACTIVITY = 'unsplash';

const UNSPLASH_ICON =
  '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M7.5 6.75V0h9v6.75h-9zm9 3.75H24V24H0V10.5h7.5v6.75h9V10.5z"/></svg>';

/**
 * Unsplash source plugin. Registers a custom config key
 * (`unsplashAccessKey`), an Unsplash icon, locale entries, and a source
 * button + an activity that mounts a v2 `<uc-unsplash-source>` block.
 */
export const unsplashPlugin = definePlugin({
  id: 'unsplash',
  setup({ uploader, sources, activities, config, locale, icons }) {
    void uploader;
    icons.register('unsplash', UNSPLASH_ICON);
    config.register('unsplashAccessKey', DEFAULT_ACCESS_KEY);
    locale.merge({
      'unsplash-label': 'Unsplash',
      'unsplash-search-placeholder': 'Search photos…',
      'unsplash-search': 'Search',
      'unsplash-loading': 'Loading photos…',
      'unsplash-no-key': 'No Unsplash API key configured. Set it with config.set("unsplashAccessKey", "…").',
    });

    sources.register({
      id: 'unsplash',
      label: 'unsplash-label',
      icon: 'unsplash',
      onSelect: () => uploader.router.navigate(UNSPLASH_ACTIVITY),
    });

    activities.register({
      id: UNSPLASH_ACTIVITY,
      routes: { onFileAdd: 'upload-list', onCancel: 'start-from' },
      render(host) {
        const el = document.createElement('uc-unsplash-source');
        host.append(el);
        return () => host.replaceChildren();
      },
    });
  },
});
