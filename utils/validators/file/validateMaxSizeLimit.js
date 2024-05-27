// @ts-check
import { buildOutputFileError } from '../../buildOutputError.js';
import { prettyBytes } from '../../prettyBytes.js';

/**
 * @private
 * @param {import('../../../types/index.js').OutputFileEntry} outputEntry
 * @param {import('../../../abstract/TypedData.js').TypedData} internalEntry
 * @param {import('../../../abstract/UploaderBlock.js').UploaderBlock} block
 */
export const validateMaxSizeLimit = (outputEntry, internalEntry, block) => {
  const maxFileSize = block.cfg.maxLocalFileSizeBytes;
  const fileSize = outputEntry.size;
  if (maxFileSize && fileSize && fileSize > maxFileSize) {
    return buildOutputFileError({
      type: 'FILE_SIZE_EXCEEDED',
      message: block.l10n('files-max-size-limit-error', { maxFileSize: prettyBytes(maxFileSize) }),
      entry: outputEntry,
    });
  }
};
