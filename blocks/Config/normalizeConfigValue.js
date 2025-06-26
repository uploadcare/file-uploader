// @ts-check

import { initialConfig } from './initialConfig.js';
import {
  asString,
  asNumber,
  asFunction,
  asBoolean,
  asObject,
  asArray,
  asMetadata,
  asCameraCapture,
  asCameraMode,
  asCameraModes,
  asStore,
  asFilesViewMode,
} from './validatorsType.js';

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
  externalSourcesEmbedCss: asString,
  store: asStore,
  cameraMirror: asBoolean,
  cameraCapture: asCameraCapture,
  sourceList: asString,
  topLevelOrigin: asString,
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
  cdnCnamePrefixed: asString,
  baseUrl: asString,
  socialBaseUrl: asString,
  secureSignature: asString,
  secureExpire: asString,
  secureDeliveryProxy: asString,
  retryThrottledRequestMaxTimes: asNumber,
  retryNetworkErrorMaxTimes: asNumber,
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
  secureUploadsExpireThreshold: asNumber,
  localeDefinitionOverride: /** @type {typeof asObject<import('../../types').LocaleDefinitionOverride>} */ (asObject),
  secureUploadsSignatureResolver:
    /** @type {typeof asFunction<import('../../types').SecureUploadsSignatureResolver>} */ (asFunction),
  secureDeliveryProxyUrlResolver:
    /** @type {typeof asFunction<import('../../types').SecureDeliveryProxyUrlResolver>} */ (asFunction),
  iconHrefResolver: /** @type {typeof asFunction<import('../../types').IconHrefResolver>} */ (asFunction),
  fileValidators: /** @type {typeof asArray<import('../../types').FileValidators>} */ (asArray),
  collectionValidators: /** @type {typeof asArray<import('../../types').CollectionValidators>} */ (asArray),

  cameraModes: asCameraModes,
  defaultCameraMode: asCameraMode,
  enableAudioRecording: asBoolean,
  enableVideoRecording: asBoolean,
  mediaRecorderOptions: asObject,

  maxVideoRecordingDuration: asNumber,

  filesViewMode: asFilesViewMode,
  gridShowFileNames: asBoolean,
  cloudImageEditorAutoOpen: asBoolean,
  cloudImageEditorMaskHref: asString,

  testMode: asBoolean,
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
