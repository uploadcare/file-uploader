// @ts-check

import { buildOutputFileError } from '../../buildOutputError.js';

/**
 * @private
 * @param {import('../../../types/index.js').OutputFileEntry} outputEntry
 * @param {import('../../../abstract/TypedData.js').TypedData} internalEntry
 * @param {import('../../../abstract/UploaderBlock.js').UploaderBlock} block
 */
export const validateIsImage = (outputEntry, internalEntry, block) => {
  const imagesOnly = block.cfg.imgOnly;
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

  return buildOutputFileError({
    type: 'NOT_AN_IMAGE',
    message: block.l10n('images-only-accepted'),
    entry: outputEntry,
  });
};
