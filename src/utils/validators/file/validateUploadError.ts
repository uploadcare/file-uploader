import { AuthTokenResolverError, NetworkError, UploadError } from '@uploadcare/upload-client';
import type { Uid } from '../../../abstract/Uid';
import type { FuncFileValidator } from '../../../abstract/validatorTypes';

export const validateUploadError: FuncFileValidator = (outputEntry, api) => {
  const { internalId } = outputEntry;

  if (!api._uploadCollection.hasItem(internalId as Uid)) {
    return;
  }
  const internalEntry = api._uploadCollection.read(internalId as Uid);

  const cause: unknown = internalEntry?.get('uploadError');
  if (!cause) {
    return;
  }

  // Before the rest: this one never reached Upload API, so it says the
  // integrator's own token endpoint failed rather than that we refused the
  // upload.
  if (cause instanceof AuthTokenResolverError) {
    return {
      type: 'AUTH_TOKEN_ERROR',
      message: cause.message,
      payload: {
        entry: outputEntry,
        error: cause,
      },
    };
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
