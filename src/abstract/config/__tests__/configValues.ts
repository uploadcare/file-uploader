import type { ConfigType } from '../../../types/exported';

/**
 * Every value each option's type permits, as one table shared by the two
 * layers that must accept them: `normalizeConfigValue` directly, and a real
 * `<uc-config>` element.
 *
 * Typed as every key of `ConfigType` mapped to an array of its own type, so
 * the compiler rejects a value an option does not allow and a new option
 * fails to compile until it is listed.
 *
 * Two deliberate absences, both documented behavior rather than gaps:
 * `cdnCname`'s default is the sentinel that asks `computed-properties` to swap
 * in the pubkey-prefixed CDN base, so it is the one value that does not read
 * back as it was set; and `localeName` names a locale a consumer registers
 * through `defineLocale` rather than one that only exists as a file on disk,
 * since only `en` ships registered.
 */

/** Registered by the element-level consumer; the validator only sees a string. */
export const TEST_LOCALE = 'xx-test';

const noop = () => {};

export const CONFIG_VALUES: { [K in keyof ConfigType]: ConfigType[K][] } = {
  pubkey: ['', 'demopublickey'],
  multiple: [true, false],
  multipleMin: [0, 5],
  multipleMax: [1, Number.MAX_SAFE_INTEGER],
  confirmUpload: [true, false],
  imgOnly: [true, false],
  accept: ['', 'image/*', '.jpg,.png'],
  externalSourcesPreferredTypes: ['', 'image/*'],
  externalSourcesEmbedCss: ['', 'body { background: #fff }'],
  store: [true, false, 'auto'],
  cameraMirror: [true, false],
  cameraCapture: ['', 'user', 'environment'],
  sourceList: ['', 'local', 'local, url, camera'],
  topLevelOrigin: ['', 'https://example.com'],
  maxLocalFileSizeBytes: [0, 1024 * 1024],
  thumbSize: [76, 120],
  showEmptyList: [true, false],
  useLocalImageEditor: [true, false],
  useCloudImageEditor: [true, false],
  cloudImageEditorTabs: ['crop', 'crop, tuning, filters'],
  removeCopyright: [true, false],
  cropPreset: ['', '1:1', '16:9 4:3'],
  imageShrink: ['', '1024x1024 90%'],
  modalScrollLock: [true, false],
  modalBackdropStrokes: [true, false],
  sourceListWrap: [true, false],
  remoteTabSessionKey: ['', 'session-key'],
  // The default is deliberately absent: holding it is the signal that asks
  // `computed-properties` to swap in the pubkey-prefixed CDN base, so it is
  // the one value that does not read back as it was set.
  cdnCname: ['https://cdn.example.com'],
  cdnCnamePrefixed: ['https://ucarecd.net', 'https://cdn.example.com'],
  baseUrl: ['https://upload.uploadcare.com', 'https://upload.example.com'],
  socialBaseUrl: ['https://social.uploadcare.com', 'https://social.example.com'],
  secureSignature: ['', 'deadbeef'],
  secureExpire: ['', '1700000000'],
  secureDeliveryProxy: ['', 'https://proxy.example.com/{previewUrl}'],
  retryThrottledRequestMaxTimes: [0, 3],
  retryNetworkErrorMaxTimes: [0, 3],
  multipartMinFileSize: [0, 26214400],
  multipartChunkSize: [1, 5242880],
  maxConcurrentRequests: [1, 10],
  multipartMaxConcurrentRequests: [1, 4],
  multipartMaxAttempts: [1, 3],
  checkForUrlDuplicates: [true, false],
  saveUrlForRecurrentUploads: [true, false],
  groupOutput: [true, false],
  userAgentIntegration: ['', 'MyApp/1.0'],
  debug: [true, false],
  localeName: ['en', TEST_LOCALE],
  secureUploadsExpireThreshold: [0, 600000],
  plugins: [[]],

  metadata: [{}, { subject: 'id-card' }, () => ({ subject: 'id-card' }), async () => ({ subject: 'id-card' }), null],
  tags: [[], ['one', 'two'], () => ['one'], async () => ['one'], null],
  localeDefinitionOverride: [{}, { en: { 'upload-file': 'Upload' } }, null],
  secureUploadsSignatureResolver: [async () => ({ secureSignature: 'sig', secureExpire: 'exp' }), null],
  authToken: [
    'eyJ.plain.sig',
    () => 'eyJ',
    async () => 'eyJ',
    { getToken: () => 'eyJ' },
    { getToken: async () => 'eyJ', invalidate: noop },
    null,
  ],
  secureDeliveryProxyUrlResolver: [async () => 'https://proxy.example.com/x', null],
  iconHrefResolver: [(iconName: string) => `#icon-${iconName}`, null],
  fileValidators: [[], [() => undefined]],
  collectionValidators: [[], [() => undefined]],
  validationTimeout: [0, 15000],
  validationConcurrency: [1, 100],

  cameraModes: ['photo', 'video', 'photo, video', 'video, photo'],
  defaultCameraMode: ['photo', 'video', null],
  enableAudioRecording: [true, false],
  enableVideoRecording: [true, false, null],
  maxVideoRecordingDuration: [0, 30, null],
  mediaRecorderOptions: [{}, { mimeType: 'video/webm' }, null],

  filesViewMode: ['grid', 'list'],
  gridShowFileNames: [true, false],
  cloudImageEditorAutoOpen: [true, false],
  qualityInsights: [true, false],
  cloudImageEditorMaskHref: ['https://example.com/mask.svg', null],
  testMode: [true, false],
  pasteScope: ['local', 'global', false],
  dynamicButtonViewMode: ['auto', 'menu', 'toolbar', 'compact', 'plain'],
  dynamicButtonShowFirstIcon: [true, false],
};
