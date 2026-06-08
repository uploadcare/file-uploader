import { shrinkFile } from '@uploadcare/image-shrink';
import { definePlugin } from '../abstract/plugin';
import { parseShrink } from '../utils/parseShrink';

/**
 * Image shrink plugin. Registers a beforeUpload hook that, when the
 * `imageShrink` config is set (e.g. `"1024x768 80%"`), passes each File
 * through `@uploadcare/image-shrink` before it hits the upload-client.
 *
 * Non-image files and URL-only items pass through unchanged (the hook only
 * runs on File inputs; shrinkFile silently no-ops for non-images).
 */
export const imageShrinkPlugin = definePlugin({
  id: 'image-shrink',
  setup({ uploader, hooks }) {
    hooks.beforeUpload(async ({ file }) => {
      const cfg = uploader.config.values as { imageShrink?: string };
      if (!cfg.imageShrink) return;
      const settings = parseShrink(cfg.imageShrink);
      if (!settings) {
        console.warn('[image-shrink] settings are invalid, skipping');
        return;
      }
      try {
        const shrunk = await shrinkFile(file, settings);
        // shrinkFile returns a Blob; rewrap as a File so the upload-client
        // and downstream hooks see the original filename + lastModified.
        const wrapped = new File([shrunk], file.name, {
          type: shrunk.type || file.type,
          lastModified: file.lastModified,
        });
        return { file: wrapped };
      } catch (err) {
        console.warn('[image-shrink] shrink failed, using original', err);
        return;
      }
    });
  },
});
