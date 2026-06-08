import { ALL_TABS } from '../blocks/CloudImageEditor/src/toolbar-constants';
import type { ConfigType } from '../types/exported';
import { serializeCsv } from '../utils/comma-separated';

/**
 * v2 default config. Mirrors v1's `initialConfig` but lives under
 * `src/v2/` so the controller doesn't depend on the v1 block tree.
 *
 * Public CDN / API base URLs are constants here (rather than re-export
 * targets like in v1's `Config` block) — consumers override them via
 * attributes / properties on `<uc-uploader>`.
 */
export const DEFAULT_CDN_CNAME = 'https://ucarecdn.com';
export const DEFAULT_BASE_URL = 'https://upload.uploadcare.com';
export const DEFAULT_SOCIAL_BASE_URL = 'https://social.uploadcare.com';
export const DEFAULT_PREFIXED_CDN_BASE_DOMAIN = 'https://ucarecd.net';

const defaults = {
  pubkey: '',
  multiple: true,
  multipleMin: 0,
  multipleMax: Number.MAX_SAFE_INTEGER,

  confirmUpload: false,
  imgOnly: false,
  accept: '',
  externalSourcesPreferredTypes: '',
  externalSourcesEmbedCss: '',
  store: 'auto',
  cameraMirror: false,
  cameraCapture: '',
  sourceList: 'local, url, camera, dropbox, gdrive',
  topLevelOrigin: '',
  maxLocalFileSizeBytes: 0,
  thumbSize: 76,
  showEmptyList: false,
  useLocalImageEditor: false,
  removeCopyright: false,
  cropPreset: '',
  imageShrink: '',

  modalScrollLock: true,
  modalBackdropStrokes: false,
  sourceListWrap: true,

  remoteTabSessionKey: '',
  cdnCname: DEFAULT_CDN_CNAME,
  cdnCnamePrefixed: DEFAULT_PREFIXED_CDN_BASE_DOMAIN,
  baseUrl: DEFAULT_BASE_URL,
  socialBaseUrl: DEFAULT_SOCIAL_BASE_URL,
  secureSignature: '',
  secureExpire: '',
  secureDeliveryProxy: '',
  retryThrottledRequestMaxTimes: 3,
  retryNetworkErrorMaxTimes: 3,
  multipartMinFileSize: 26214400,
  multipartChunkSize: 5242880,
  maxConcurrentRequests: 10,
  multipartMaxConcurrentRequests: 4,
  multipartMaxAttempts: 3,
  checkForUrlDuplicates: false,
  saveUrlForRecurrentUploads: false,

  groupOutput: false,
  userAgentIntegration: '',
  debug: false,

  metadata: null,
  localeName: 'en',
  localeDefinitionOverride: null,
  secureUploadsExpireThreshold: 10 * 60 * 1000,
  secureUploadsSignatureResolver: null,
  secureDeliveryProxyUrlResolver: null,
  iconHrefResolver: null,
  fileValidators: [],
  collectionValidators: [],
  validationTimeout: 15 * 1000,
  validationConcurrency: 100,

  cameraModes: 'photo, video',
  defaultCameraMode: null,
  enableAudioRecording: true,
  enableVideoRecording: null,
  maxVideoRecordingDuration: null,
  mediaRecorderOptions: null,

  filesViewMode: 'list',
  gridShowFileNames: false,

  useCloudImageEditor: true,
  cloudImageEditorAutoOpen: false,
  cloudImageEditorTabs: serializeCsv(ALL_TABS),
  cloudImageEditorMaskHref: null,

  testMode: false,

  qualityInsights: true,
  pasteScope: 'local',

  // dynamic button (regular preset's dynamic toolbar). `auto` picks
  // wrap vs no-wrap based on viewport; `firstIcon` toggles the leading
  // upload icon. Defaults match v1's `initialConfig`.
  dynamicButtonViewMode: 'auto',
  dynamicButtonShowFirstIcon: true,

  plugins: [],
} satisfies ConfigType;

export const defaultConfig: Readonly<ConfigType> = Object.freeze(defaults);
