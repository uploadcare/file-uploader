import { shrinkFile } from '@uploadcare/image-shrink';
import type { UploaderPlugin } from '../abstract/managers/plugin';
import { parseShrink } from '../utils/parseShrink';

// The message @uploadcare/image-shrink throws for an image already under the limit; it exports no error code.
const SHRINK_NOT_REQUIRED = 'Not required';

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
          pluginApi.logger.warn('Image shrink settings are invalid, skipping shrinking');
          return { file };
        }

        try {
          const shrunk = await shrinkFile(file, settings);
          return { file: shrunk };
        } catch (error) {
          // Nothing to warn about when the image needed no shrinking.
          if (!(error instanceof Error && error.message === SHRINK_NOT_REQUIRED)) {
            pluginApi.logger.warn('Image shrink failed, uploading the original', error);
          }
          return { file };
        }
      },
    });
  },
};
