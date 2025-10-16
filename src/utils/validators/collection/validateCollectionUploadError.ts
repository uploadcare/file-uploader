import type { FuncCollectionValidator } from '../../../abstract/managers/ValidationManager';

export const validateCollectionUploadError: FuncCollectionValidator = (collection, api) => {
  if (collection.failedCount > 0) {
    return {
      type: 'SOME_FILES_HAS_ERRORS',
      message: api.l10n('some-files-were-not-uploaded'),
    };
  }
  return undefined;
};
