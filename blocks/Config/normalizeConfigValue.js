// @ts-check

import { initialConfig } from './initialConfig.js';

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
export const asBoolean = (value) => {
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
    throw new Error(`Invalid "cameraCapture" value: "${strValue}"`);
  }
  return strValue;
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

/** @param {unknown} value */
const asLocaleDefinitionOverride = (value) => {
  if (typeof value === 'object') {
    return /** @type {import('../../types').LocaleDefinitionOverride} */ (value);
  }

  throw new Error('Invalid localeDefinitionOverride value. Must be an object.');
};

/**
 * @type {{
 *   [Key in keyof import('../../types').ConfigType]: (
 *     value: unknown,
 *   ) => import('../../types').ConfigType[Key] | undefined;
 * }}
 */
const mapping = {
  pubkey: asString,
  multiple: asBoolean,
  multipleMin: asNumber,
  multipleMax: asNumber,

  confirmUpload: asBoolean,
  imgOnly: asBoolean,
  accept: asString,
  externalSourcesPreferredTypes: asString,
  store: asStore,
  cameraMirror: asBoolean,
  cameraCapture: asCameraCapture,
  sourceList: asString,
  maxLocalFileSizeBytes: asNumber,
  thumbSize: asNumber,
  showEmptyList: asBoolean,
  useLocalImageEditor: asBoolean,
  useCloudImageEditor: asBoolean,
  cloudImageEditorTabs: asString,
  removeCopyright: asBoolean,
  cropPreset: asString,
  imageShrink: asString,

  modalScrollLock: asBoolean,
  modalBackdropStrokes: asBoolean,

  sourceListWrap: asBoolean,

  remoteTabSessionKey: asString,
  cdnCname: asString,
  baseUrl: asString,
  socialBaseUrl: asString,
  secureSignature: asString,
  secureExpire: asString,
  secureDeliveryProxy: asString,
  retryThrottledRequestMaxTimes: asNumber,
  multipartMinFileSize: asNumber,
  multipartChunkSize: asNumber,
  maxConcurrentRequests: asNumber,
  multipartMaxConcurrentRequests: asNumber,
  multipartMaxAttempts: asNumber,
  checkForUrlDuplicates: asBoolean,
  saveUrlForRecurrentUploads: asBoolean,

  groupOutput: asBoolean,
  userAgentIntegration: asString,
  debug: asBoolean,

  localeName: asString,

  metadata: asMetadata,
  localeDefinitionOverride: asLocaleDefinitionOverride,
};

/**
 * @template {keyof import('../../types').ConfigType} T
 * @param {T} key
 * @param {unknown} value
 * @returns {import('../../types').ConfigType[T] | undefined}
 */
export const normalizeConfigValue = (key, value) => {
  if (typeof value === 'undefined' || value === null) {
    return undefined;
  }

  try {
    return mapping[key](value);
  } catch (reason) {
    console.error(`Invalid value for config key "${key}".`, reason);
    return initialConfig[key];
  }
};
