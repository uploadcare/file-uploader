// @ts-check

/** @type {import('../../../abstract/ValidationManager.js').FuncCollectionValidator} */
export const validateCollectionUploadError = (collection, api) => {
  if (collection.failedCount > 0) {
    return {
      type: 'SOME_FILES_HAS_ERRORS',
      message: api.l10n('some-files-were-not-uploaded'),
    };
  }
};
