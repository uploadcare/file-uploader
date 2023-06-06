// @ts-check

export const DEFAULT_CDN_CNAME = 'https://ucarecdn.com';
export const DEFAULT_BASE_URL = 'https://upload.uploadcare.com';
export const DEFAULT_SOCIAN_BASE_URL = 'https://social.uploadcare.com';

/** @type {import('../../types/exported').ConfigType} */
export const initialConfig = Object.freeze({
  pubkey: '',
  multiple: true,
  multipleMin: 0,
  multipleMax: 0,

  confirmUpload: false,
  imgOnly: false,
  accept: '',
  externalSourcesPreferredTypes: '',
  store: 'auto',
  cameraMirror: false,
  sourceList: 'local, url, camera, dropbox, gdrive',
  maxLocalFileSizeBytes: 0,
  thumbSize: 76,
  showEmptyList: false,
  useLocalImageEditor: false,
  useCloudImageEditor: true,
  removeCopyright: false,

  modalScrollLock: true,
  modalBackdropStrokes: false,

  sourceListWrap: true,

  remoteTabSessionKey: '',
  cdnCname: DEFAULT_CDN_CNAME,
  baseUrl: DEFAULT_BASE_URL,
  socialBaseUrl: DEFAULT_SOCIAN_BASE_URL,
  secureSignature: '',
  secureExpire: '',
  secureDeliveryProxy: '',
  retryThrottledRequestMaxTimes: 1,
  multipartMinFileSize: 26214400,
  multipartChunkSize: 5242880,
  maxConcurrentRequests: 10,
  multipartMaxConcurrentRequests: 4,
  multipartMaxAttempts: 3,
  checkForUrlDuplicates: false,
  saveUrlForRecurrentUploads: false,

  groupOutput: false,
  userAgentIntegration: '',
});
