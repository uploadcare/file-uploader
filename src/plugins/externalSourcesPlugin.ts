import { ExternalUploadSource } from '../utils/UploadSource';
import '../blocks/ExternalSource/ExternalSource';
import { definePlugin } from '../abstract/plugin';
import type { ExternalSource } from '../blocks/ExternalSource/ExternalSource';

/**
 * External sources plugin. Registers the social sources (Facebook,
 * Dropbox, Google Drive, …) and a single 'external' activity that
 * mounts a v2 `<uc-external-source>` block. The block runs the iframe
 * message bridge + selection toolbar.
 */
export const externalSourcesPlugin = definePlugin({
  id: 'external-sources',
  setup({ uploader, sources, activities }) {
    for (const sourceId of Object.values(ExternalUploadSource)) {
      sources.register({
        id: sourceId,
        // Locale keys match v1's `src-type-<id>` convention; the
        // SourceBtn runs the label through `t()` so the dictionary
        // entry resolves at render time.
        label: `src-type-${sourceId}`,
        icon: sourceId,
        onSelect: () => uploader.router.navigate('external', { externalSourceType: sourceId }),
      });
    }

    activities.register({
      id: 'external',
      routes: { onDone: 'upload-list', onCancel: 'start-from' },
      render(host, params) {
        const el = document.createElement('uc-external-source') as unknown as ExternalSource;
        el.externalSourceType = String(params.externalSourceType ?? '');
        host.append(el);
        return () => host.replaceChildren();
      },
    });
  },
});
