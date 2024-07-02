// @ts-check
import { prettyBytes } from '../../prettyBytes.js';

/** @type {import('../../../abstract/ValidationManager.js').FuncFileValidator} */
export const validateMaxSizeLimit = (outputEntry, api) => {
  const maxFileSize = api.cfg.maxLocalFileSizeBytes;
  const fileSize = outputEntry.size;
  if (maxFileSize && fileSize && fileSize > maxFileSize) {
    return {
      type: 'FILE_SIZE_EXCEEDED',
      message: api.l10n('files-max-size-limit-error', { maxFileSize: prettyBytes(maxFileSize) }),
      payload: { entry: outputEntry },
    };
  }
};
