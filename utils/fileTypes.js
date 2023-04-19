import { stringToArray } from './stringToArray.js';

export const IMAGE_ACCEPT_LIST = [
  'image/*',
  'image/heif',
  'image/heif-sequence',
  'image/heic',
  'image/heic-sequence',
  'image/avif',
  'image/avif-sequence',
  '.heif',
  '.heifs',
  '.heic',
  '.heics',
  '.avif',
  '.avifs',
];

/**
 * @param {string[]} [fileTypes]
 * @returns {string[]}
 */
export const mergeFileTypes = (fileTypes) => {
  if (!fileTypes) {
    return [];
  }
  return fileTypes
    .filter((item) => typeof item === 'string')
    .map((str) => stringToArray(str))
    .flat();
};

/**
 * @param {String} fileType
 * @param {String[]} allowedFileTypes
 * @returns {Boolean}
 */
export const matchFileType = (fileType, allowedFileTypes) => {
  return allowedFileTypes.some((type) => {
    if (type.endsWith('*')) {
      type = type.replace('*', '');
      return fileType.startsWith(type);
    }

    return fileType === type;
  });
};

/**
 * @param {File} file
 * @returns {Boolean}
 */
export const fileIsImage = (file) => {
  let type = file?.type;
  if (!type) {
    return false;
  }
  return matchFileType(type, IMAGE_ACCEPT_LIST);
};
