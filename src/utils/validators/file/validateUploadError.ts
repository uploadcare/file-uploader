import { AuthTokenResolverError, NetworkError, UploadError } from '@uploadcare/upload-client';
import type { UploadCollectionController } from '../../../abstract/controllers/UploadCollectionController';
import type { Uid } from '../../../abstract/Uid';
import type { OutputErrorFile, OutputFileEntry } from '../../../types/index';

/**
 * Classifies a failed upload from the cause kept on its entry. Built in, so it reads the collection directly; a
 * custom validator gets only the public api.
 */
export const validateUploadError = (
  outputEntry: OutputFileEntry,
  collection: Pick<UploadCollectionController, 'hasItem' | 'read'>,
): OutputErrorFile | undefined => {
  const { internalId } = outputEntry;

  if (!collection.hasItem(internalId as Uid)) {
    return;
  }
  const internalEntry = collection.read(internalId as Uid);

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
