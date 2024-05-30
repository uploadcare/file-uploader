// @ts-check
import { NetworkError, UploadError } from '@uploadcare/upload-client';

/** @type {import('../../../abstract/ValidationManager.js').FuncFileValidator} */
export const validateUploadError = (outputEntry, internalEntry, block) => {
  /** @type {unknown} */
  const cause = internalEntry?.getValue('uploadError');
  if (!cause) {
    return;
  }

  if (cause instanceof UploadError) {
    return {
      type: 'UPLOAD_ERROR',
      message: cause.message,
      payload: {
        entry: outputEntry,
        error: cause,
      },
    };
  }

  if (cause instanceof NetworkError) {
    return {
      type: 'NETWORK_ERROR',
      message: cause.message,
      payload: {
        entry: outputEntry,
        error: cause,
      },
    };
  }

  const error = cause instanceof Error ? cause : new Error('Unknown error', { cause });
  return {
    type: 'UNKNOWN_ERROR',
    message: error.message,
    payload: {
      entry: outputEntry,
      error,
    },
  };
};
