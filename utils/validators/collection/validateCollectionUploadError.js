// @ts-check

/** @type {import('../../../abstract/ValidationManager.js').FuncCollectionValidator} */
export const validateCollectionUploadError = (collection, block) => {
  if (collection.failedCount > 0) {
    return {
      type: 'SOME_FILES_HAS_ERRORS',
      message: block.l10n('some-files-were-not-uploaded'),
    };
  }
};
