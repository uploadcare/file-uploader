// @ts-check
import { buildOutputFileError } from '../../buildOutputError.js';
import { prettyBytes } from '../../prettyBytes.js';

/** @type import('../../../abstract/ValidationManager.js').FuncFileValidator */
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
