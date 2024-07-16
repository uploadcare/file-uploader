// @ts-check

/** @type {import('../../../abstract/ValidationManager.js').FuncFileValidator} */
export const validateIsImage = (outputEntry, api) => {
  const imagesOnly = api.cfg.imgOnly;
  const isImage = outputEntry.isImage;

  if (!imagesOnly || isImage) {
    return;
  }
  if (!outputEntry.fileInfo && outputEntry.externalUrl) {
    // skip validation for not uploaded files with external url, cause we don't know if they're images or not
    return;
  }
  if (!outputEntry.fileInfo && !outputEntry.mimeType) {
    // skip validation for not uploaded files without mime-type, cause we don't know if they're images or not
    return;
  }

  return {
    type: 'NOT_AN_IMAGE',
    message: api.l10n('images-only-accepted'),
    payload: { entry: outputEntry },
  };
};
