import type {
  CollectionValidators,
  ConfigType,
  FileValidators,
  IconHrefResolver,
  LocaleDefinitionOverride,
  SecureDeliveryProxyUrlResolver,
  SecureUploadsSignatureResolver,
  UploaderPlugin,
} from '../../types/index';
import { initialConfig } from './initialConfig';
import {
  asArray,
  asBoolean,
  asCameraCapture,
  asCameraMode,
  asCameraModes,
  asFilesViewMode,
  asFunction,
  asMetadata,
  asNumber,
  asObject,
  asPasteScope,
  asStore,
  asString,
} from './validatorsType';

type ConfigNormalizer<TKey extends keyof ConfigType> = (value: unknown) => ConfigType[TKey] | undefined;

const mapping: { [Key in keyof ConfigType]: ConfigNormalizer<Key> } = {
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
  localeDefinitionOverride: (value) => asObject<LocaleDefinitionOverride>(value),
  secureUploadsSignatureResolver: (value) => asFunction<SecureUploadsSignatureResolver>(value),
  secureDeliveryProxyUrlResolver: (value) => asFunction<SecureDeliveryProxyUrlResolver>(value),
  iconHrefResolver: (value) => asFunction<IconHrefResolver>(value),
  plugins: (value) => asArray<UploaderPlugin[]>(value),
  fileValidators: asArray<FileValidators>,
  collectionValidators: asArray<CollectionValidators>,
  validationTimeout: asNumber,
  validationConcurrency: asNumber,

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

  qualityInsights: asBoolean,
  pasteScope: asPasteScope,
};

export const normalizeConfigValue = <T extends keyof ConfigType>(key: T, value: unknown): ConfigType[T] | undefined => {
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
