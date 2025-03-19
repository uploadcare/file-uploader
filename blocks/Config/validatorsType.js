// @ts-check
import { CameraSourceTypes } from '../CameraSource/constants.js';
import { deserializeCsv } from '../utils/comma-separated.js';

/** @param {unknown} value */
const asString = (value) => String(value);

/** @param {unknown} value */
const asNumber = (value) => {
  const number = Number(value);
  if (Number.isNaN(number)) {
    throw new Error(`Invalid number: "${value}"`);
  }
  return number;
};
/** @param {unknown} value */
const asBoolean = (value) => {
  if (typeof value === 'undefined' || value === null) return false;
  if (typeof value === 'boolean') return value;
  // for attr like multiple="true" (react will pass it as string)
  if (value === 'true') return true;
  // for attr flags like multiple="" (some other libs will pass it as empty string)
  if (value === '') return true;
  // for attr like multiple="false" (react will pass it as string)
  if (value === 'false') return false;
  throw new Error(`Invalid boolean: "${value}"`);
};
/** @param {unknown} value */
const asStore = (value) => (value === 'auto' ? value : asBoolean(value));

/** @param {unknown} value */
const asCameraCapture = (value) => {
  const strValue = asString(value);
  if (strValue !== 'user' && strValue !== 'environment' && strValue !== '') {
    throw new Error(`Invalid value: "${strValue}"`);
  }
  return strValue;
};

/** @param {unknown} value */
const asCameraMode = (value) => {
  const strValue = asString(value);
  if (!Object.values(CameraSourceTypes).includes(strValue)) {
    throw new Error(`Invalid value: "${strValue}"`);
  }
  return /** @type {import('../CameraSource/CameraSource.js').CameraMode} */ (strValue);
};

/** @param {unknown} value */
const asCameraModes = (value) => {
  const str = asString(value);
  const array = deserializeCsv(str);
  if (array.some((item) => !Object.values(CameraSourceTypes).includes(item))) {
    throw new Error(`Invalid value: "${JSON.stringify(array)}"`);
  }
  return str;
};

/** @param {unknown} value */
const asMetadata = (value) => {
  if (typeof value === 'object' && !Array.isArray(value)) {
    return /** @type {import('../../types').Metadata} */ (value);
  }
  if (typeof value === 'function') {
    return /** @type {import('../../types').MetadataCallback} */ (value);
  }

  throw new Error('Invalid metadata value. Must be an object or function.');
};

/**
 * @template {{}} T
 * @param {unknown} value
 * @returns {T}
 */
const asObject = (value) => {
  if (typeof value === 'object') {
    return /** @type {T} */ (value);
  }

  throw new Error('Invalid value. Must be an object.');
};

/**
 * @template {Function} T
 * @param {unknown} value
 * @returns {T}
 */
const asFunction = (value) => {
  if (typeof value === 'function') {
    return /** @type {T} */ (value);
  }

  throw new Error('Invalid value. Must be a function.');
};

/**
 * @template {Function[] | string | {}} T
 * @param {unknown} value
 * @returns {T}
 */
const asArray = (value) => {
  if (Array.isArray(value)) {
    return /** @type {T} */ (value);
  }

  throw new Error('Must be an array.');
};

/** @param {unknown} value */
const asFilesViewMode = (value) => {
  const strValue = asString(value);

  if (['grid', 'list'].includes(strValue)) {
    return /** @type {import('../UploadList/UploadList.js').FilesViewMode} */ (strValue);
  }

  throw new Error(`Invalid value: "${strValue}"`);
};

export {
  asString,
  asNumber,
  asBoolean,
  asStore,
  asCameraCapture,
  asCameraMode,
  asCameraModes,
  asMetadata,
  asObject,
  asFunction,
  asArray,
  asFilesViewMode,
};
