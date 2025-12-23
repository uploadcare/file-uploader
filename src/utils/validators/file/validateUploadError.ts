import { NetworkError, UploadError } from '@uploadcare/upload-client';
import type { FuncFileValidator } from '../../../abstract/managers/ValidationManager';
import type { Uid } from '../../../lit/Uid';

export const validateUploadError: FuncFileValidator = (outputEntry, api) => {
  const { internalId } = outputEntry;

  if (!api._uploadCollection.hasItem(internalId as Uid)) {
    return;
  }
  const internalEntry = api._uploadCollection.read(internalId as Uid);

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
