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
 * }} ConfigType
 */

/**
 * @template S
 * @typedef {S extends `${infer C}${infer T}`
 *   ? T extends Uncapitalize<T>
 *     ? `${Uncapitalize<C>}${KebabCase<T>}`
 *     : `${Uncapitalize<C>}-${KebabCase<T>}`
 *   : S} KebabCase
 */

/**
 * @template T
 * @typedef {{
 *   [Key in keyof T as KebabCase<Key>]: T[Key];
 * }} KebabCaseKeys
 */

/** @typedef {KebabCaseKeys<ConfigType>} ConfigTypeAttributes */

export {};
