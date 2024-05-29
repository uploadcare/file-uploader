// @ts-check
import { IMAGE_ACCEPT_LIST, matchExtension, matchMimeType, mergeFileTypes } from '../../fileTypes.js';
import { buildOutputFileError } from '../../buildOutputError.js';

/** @type import('../../../abstract/ValidationManager.js').FuncFileValidator */
export const validateFileType = (outputEntry, internalEntry, block) => {
  const imagesOnly = block.cfg.imgOnly;
  const accept = block.cfg.accept;
  const allowedFileTypes = mergeFileTypes([...(imagesOnly ? IMAGE_ACCEPT_LIST : []), accept]);
  if (!allowedFileTypes.length) return;

  const mimeType = outputEntry.mimeType;
  const fileName = outputEntry.name;

  if (!mimeType || !fileName) {
    // Skip client validation if mime type or file name are not available for some reasons
    return;
  }

  const mimeOk = matchMimeType(mimeType, allowedFileTypes);
  const extOk = matchExtension(fileName, allowedFileTypes);

  if (!mimeOk && !extOk) {
    // Assume file type is not allowed if both mime and ext checks fail
    return buildOutputFileError({
      type: 'FORBIDDEN_FILE_TYPE',
      message: block.l10n('file-type-not-allowed'),
      entry: outputEntry,
    });
  }
};
