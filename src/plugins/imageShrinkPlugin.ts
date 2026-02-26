import { shrinkFile } from '@uploadcare/image-shrink';
import type { UploaderPlugin } from '../abstract/managers/plugin';
import { parseShrink } from '../utils/parseShrink';

export const imageShrinkPlugin: UploaderPlugin = {
  id: 'image-shrink',
  setup({ pluginApi }) {
    pluginApi.registry.registerFileHook({
      type: 'beforeUpload',
      handler: async ({ file, mimeType }) => {
        const imageShrink = pluginApi.config.get('imageShrink');
        if (!imageShrink) return { file, mimeType };

        const settings = parseShrink(imageShrink);
        if (!settings) {
          console.warn('[ImageShrinkPlugin] Image shrink settings are invalid, skipping shrinking');
          return { file, mimeType };
        }

        try {
          const shrunk = await shrinkFile(file, settings);
          return { file: shrunk, mimeType: shrunk.type || mimeType };
        } catch {
          return { file, mimeType };
        }
      },
    });
  },
};
