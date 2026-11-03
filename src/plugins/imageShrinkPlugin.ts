import { shrinkFile } from '@uploadcare/image-shrink';
import type { UploaderPlugin } from '../abstract/managers/plugin';
import { fileIsImage } from '../utils/fileTypes';
import { parseShrink } from '../utils/parseShrink';

// The messages @uploadcare/image-shrink throws for an image it leaves as is: already under the limit, or one it won't
// re-encode (a CMYK JPEG); it exports no error codes. shrinkFile rethrows them wrapped
// (`Failed to shrink image. Message: "Not required".`) with the original as `cause`.
const SHRINK_SKIPPED = ['Not required', 'Should skipped'];

const isSkipped = (error: unknown): boolean =>
  error instanceof Error && (SHRINK_SKIPPED.includes(error.message) || isSkipped(error.cause));

export const imageShrinkPlugin: UploaderPlugin = {
  id: 'image-shrink',
  setup({ pluginApi }) {
    pluginApi.registry.registerFileHook({
      type: 'beforeUpload',
      handler: async ({ file }) => {
        const imageShrink = pluginApi.config.get('imageShrink');
        if (!imageShrink || !fileIsImage(file)) return { file };

        const settings = parseShrink(imageShrink);
        if (!settings) {
          pluginApi.logger.warn('Image shrink settings are invalid, skipping shrinking');
          return { file };
        }

        try {
          const shrunk = await shrinkFile(file, settings);
          return { file: shrunk };
        } catch (error) {
          // Nothing to warn about when image-shrink left the image as is on purpose.
          if (!isSkipped(error)) {
            pluginApi.logger.warn('Image shrink failed, uploading the original', error);
          }
          return { file };
        }
      },
    });
  },
};
