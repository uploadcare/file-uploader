// @ts-check
import { NetworkError, UploadError } from '@uploadcare/upload-client';

/** @type {import('../../../abstract/ValidationManager.js').FuncFileValidator} */
export const validateUploadError = (outputEntry, block) => {
  const { internalId } = outputEntry;

  /** @type {unknown} */
  const cause = block.uploadCollection.read(internalId)?.getValue('uploadError');
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
