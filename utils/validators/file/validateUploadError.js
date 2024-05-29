// @ts-check
import { buildOutputFileError } from '../../buildOutputError.js';
import { NetworkError, UploadError } from '@uploadcare/upload-client';

/** @type import('../../../abstract/ValidationManager.js').FuncFileValidator */
export const validateUploadError = (outputEntry, internalEntry, block) => {
  /** @type {unknown} */
  const cause = internalEntry?.getValue('uploadError');
  if (!cause) {
    return;
  }

  if (cause instanceof UploadError) {
    return buildOutputFileError({
      type: 'UPLOAD_ERROR',
      message: cause.message,
      entry: outputEntry,
      error: cause,
    });
  } else if (cause instanceof NetworkError) {
    return buildOutputFileError({
      type: 'NETWORK_ERROR',
      message: cause.message,
      entry: outputEntry,
      error: cause,
    });
  } else {
    const error = cause instanceof Error ? cause : new Error('Unknown error', { cause });
    return buildOutputFileError({
      type: 'UNKNOWN_ERROR',
      message: error.message,
      entry: outputEntry,
      error,
    });
  }
};
