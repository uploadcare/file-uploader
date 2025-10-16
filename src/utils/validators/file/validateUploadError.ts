import { NetworkError, UploadError } from '@uploadcare/upload-client';
import type { FuncFileValidator } from '../../../abstract/managers/ValidationManager';

export const validateUploadError: FuncFileValidator = (outputEntry, api) => {
  const { internalId } = outputEntry;

  // @ts-expect-error Use private API that is not exposed in the types
  const internalEntry = api._uploadCollection.read(internalId);

  const cause: unknown = internalEntry?.getValue('uploadError');
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
