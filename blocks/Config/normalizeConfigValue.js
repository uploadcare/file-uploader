// @ts-check

/** @param {unknown} value */
const asString = (value) => String(value);
/** @param {unknown} value */
const asNumber = (value) => Number(value);
/** @param {unknown} value */
const asBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  // for attr like multiple="true" (react will pass it as string)
  if (value === 'true') return true;
  // for attr flags like multiple="" (some other libs will pass it as empty string)
  if (value === '') return true;
  // for attr like multiple="false" (react will pass it as string)
  if (value === 'false') return false;
  return Boolean(value);
};
/** @param {unknown} value */
const asStore = (value) => (value === 'auto' ? value : asBoolean(value));

/**
 * @type {{
 *   [Key in keyof import('../../types/exported').ConfigType]: (
 *     value: unknown
 *   ) => import('../../types/exported').ConfigType[Key];
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
  sourceList: asString,
  maxLocalFileSizeBytes: asNumber,
  thumbSize: asNumber,
  showEmptyList: asBoolean,
  useLocalImageEditor: asBoolean,
  useCloudImageEditor: asBoolean,
  removeCopyright: asBoolean,

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
};

/**
 * @template {keyof import('../../types/exported').ConfigType} T
 * @param {T} key
 * @param {unknown} value
 * @returns {import('../../types/exported').ConfigType[T]}
 */
export const normalizeConfigValue = (key, value) => {
  return mapping[key](value);
};
