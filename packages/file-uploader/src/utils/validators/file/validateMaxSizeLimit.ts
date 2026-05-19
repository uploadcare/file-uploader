import type { FuncFileValidator } from '../../../abstract/managers/ValidationManager';
import { prettyBytes } from '../../prettyBytes';

export const validateMaxSizeLimit: FuncFileValidator = (outputEntry, api) => {
  const maxFileSize = api.cfg.maxLocalFileSizeBytes;
  const fileSize = outputEntry.size;
  if (maxFileSize && fileSize && fileSize > maxFileSize) {
    return {
      type: 'FILE_SIZE_EXCEEDED',
      message: api.l10n('files-max-size-limit-error', { maxFileSize: prettyBytes(maxFileSize) }),
      payload: { entry: outputEntry },
    };
  }
  return undefined;
};
