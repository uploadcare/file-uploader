// @ts-check
import { browserInfo } from './browser-info.js';
import { stringToArray } from './stringToArray.js';

export const BASIC_IMAGE_WILDCARD = 'image/*';
export const BASIC_VIDEO_WILDCARD = 'video/*';
export const HEIC_IMAGE_MIME_LIST = [
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

export const calcImageAcceptList = () => {
  // Desktop Safari allows selecting HEIC images with simple image/* wildcard
  // But if we provide a more specific HEIC types - safari starts to convert any images to HEIC
  if (browserInfo.safariDesktop) {
    return [BASIC_IMAGE_WILDCARD];
  }
  // Other browsers allows to select HEIC images with more specific HEIC types only
  // Mobile Safari will allow to select HEIC images even with simple image/* wildcard and it will convert them to JPEG by default (behaviour could be changed in file picker UI)
  // Hope it will be fixed in the future so we'll add specific types so that Mobile Safari will know that we're supporting HEIC images
  return [BASIC_IMAGE_WILDCARD, ...HEIC_IMAGE_MIME_LIST];
};

export const IMAGE_ACCEPT_LIST = calcImageAcceptList();

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
 * @param {String} mimeType
 * @param {String[]} allowedFileTypes
 * @returns {Boolean}
 */
export const matchMimeType = (mimeType, allowedFileTypes) => {
  return allowedFileTypes.some((type) => {
    if (type.endsWith('*')) {
      type = type.replace('*', '');
      return mimeType.startsWith(type);
    }

    return mimeType === type;
  });
};

/**
 * @param {String} fileName
 * @param {String[]} allowedFileTypes
 * @returns {Boolean}
 */
export const matchExtension = (fileName, allowedFileTypes) => {
  return allowedFileTypes.some((type) => {
    if (!type.startsWith('.')) {
      return false;
    }

    return fileName.toLowerCase().endsWith(type.toLowerCase());
  });
};

/**
 * @param {File | Blob} file
 * @returns {Boolean}
 */
export const fileIsImage = (file) => {
  let type = file?.type;
  if (!type) {
    return false;
  }
  return matchMimeType(type, IMAGE_ACCEPT_LIST);
};

/**
 * Checks if the given data is a Blob.
 *
 * @param {unknown} data - The data to check.
 * @returns {boolean} - True if the data is a Blob, false otherwise.
 */
export const isBlob = (data) => {
  return typeof Blob !== 'undefined' && data instanceof Blob;
};

/**
 * Checks if the given data is a File.
 *
 * @param {unknown} data - The data to check.
 * @returns {boolean} - True if the data is a File, false otherwise.
 */
export const isFile = (data) => {
  return typeof File !== 'undefined' && data instanceof File;
};
