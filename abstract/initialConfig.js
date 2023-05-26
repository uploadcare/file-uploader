// @ts-check

/**
 * @typedef {{
 *   pubkey: string;
 *   multiple: boolean;
 *   multipleMin: number;
 *   multipleMax: number;
 *   confirmUpload: boolean;
 *   imgOnly: boolean;
 *   accept: string;
 *   externalSourcesPreferredTypes: string;
 *   store: boolean | 'auto';
 *   cameraMirror: boolean;
 *   sourceList: string;
 *   maxLocalFileSizeBytes: number;
 *   thumbSize: number;
 *   showEmptyList: boolean;
 *   useLocalImageEditor: boolean;
 *   useCloudImageEditor: boolean;
 *   removeCopyright: boolean;
 *   modalScrollLock: boolean;
 *   modalBackdropStrokes: boolean;
 *   sourceListWrap: boolean;
 *   initActivity: string;
 *   doneActivity: string;
 *   remoteTabSessionKey: string;
 *   cdnCname: string;
 *   baseUrl: string;
 *   socialBaseUrl: string;
 *   secureSignature: string;
 *   secureExpire: string;
 *   secureDeliveryProxy: string;
 *   retryThrottledRequestMaxTimes: number;
 *   multipartMinFileSize: number;
 *   multipartChunkSize: number;
 *   maxConcurrentRequests: number;
 *   multipartMaxConcurrentRequests: number;
 *   multipartMaxAttempts: number;
 *   checkForUrlDuplicates: boolean;
 *   saveUrlForRecurrentUploads: boolean;
 *   groupOutput: boolean;
 *   userAgentIntegration: string;
 * }} Config
 */

export const DEFAULT_CDN_CNAME = 'https://ucarecdn.com';
export const DEFAULT_BASE_URL = 'https://upload.uploadcare.com';
export const DEFAULT_SOCIAN_BASE_URL = 'https://social.uploadcare.com';

/** @type {Config} */
export const initialConfig = {
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

  initActivity: 'startFrom',
  doneActivity: '',

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
};
