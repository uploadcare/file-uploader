// @ts-check
import { IMAGE_ACCEPT_LIST, matchExtension, matchMimeType, mergeFileTypes } from '../../fileTypes.js';

/** @type {import('../../../abstract/ValidationManager.js').FuncFileValidator} */
export const validateFileType = (outputEntry, api) => {
  const imagesOnly = api.cfg.imgOnly;
  const accept = api.cfg.accept;
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
    return {
      type: 'FORBIDDEN_FILE_TYPE',
      message: api.l10n('file-type-not-allowed'),
      payload: { entry: outputEntry },
    };
  }
};
