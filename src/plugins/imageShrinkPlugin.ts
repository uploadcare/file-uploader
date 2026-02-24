import { shrinkFile } from '@uploadcare/image-shrink';
import type { UploaderPlugin } from '../abstract/managers/plugin';
import { parseShrink } from '../utils/parseShrink';

export const imageShrinkPlugin: UploaderPlugin = {
  id: 'image-shrink',
  version: '0.1.0',
  setup({ pluginApi }) {
    pluginApi.registry.registerFileTransformer({
      transform: async ({ file }) => {
        const imageShrink = pluginApi.config.get('imageShrink');
        if (!imageShrink) return file;

        const settings = parseShrink(imageShrink);
        if (!settings) {
          console.warn('[ImageShrinkPlugin] Image shrink settings are invalid, skipping shrinking');
          return file;
        }

        try {
          return await shrinkFile(file, settings);
        } catch {
          return file;
        }
      },
    });
  },
};
