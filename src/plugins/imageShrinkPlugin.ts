import { shrinkFile } from '@uploadcare/image-shrink';
import { logger } from '../abstract/logger';
import type { UploaderPlugin } from '../abstract/managers/plugin';
import { parseShrink } from '../utils/parseShrink';

const log = logger.scope('image-shrink-plugin');

export const imageShrinkPlugin: UploaderPlugin = {
  id: 'image-shrink',
  setup({ pluginApi }) {
    pluginApi.registry.registerFileHook({
      type: 'beforeUpload',
      handler: async ({ file }) => {
        const imageShrink = pluginApi.config.get('imageShrink');
        if (!imageShrink) return { file };

        const settings = parseShrink(imageShrink);
        if (!settings) {
          log.warn('Image shrink settings are invalid, skipping shrinking');
          return { file };
        }

        try {
          const shrunk = await shrinkFile(file, settings);
          return { file: shrunk };
        } catch {
          return { file };
        }
      },
    });
  },
};
