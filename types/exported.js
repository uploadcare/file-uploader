// @ts-check
/** @typedef {import('@uploadcare/upload-client').Metadata} Metadata */
/** @typedef {() => Promise<Metadata>} MetadataCallback */

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
 *   metadata: Metadata | MetadataCallback | null;
 * }} ConfigType
 */

/** @typedef {Pick<ConfigType, 'metadata'>} ComplexConfigType */

/** @typedef {Omit<ConfigType, keyof ComplexConfigType>} PlainConfigType */

/**
 * @template {string} S
 * @typedef {S extends `${infer C}${infer T}`
 *   ? T extends Uncapitalize<T>
 *     ? `${Uncapitalize<C>}${KebabCase<T>}`
 *     : `${Uncapitalize<C>}-${KebabCase<T>}`
 *   : S} KebabCase
 */

/**
 * @template {Record<string, unknown>} T
 * @typedef {{
 *   [Key in keyof T as KebabCase<Key & string>]: T[Key];
 * }} KebabCaseKeys
 */

/**
 * @template {string} S
 * @typedef {Lowercase<S>} LowerCase<S>
 */

/**
 * @template {Record<string, unknown>} T
 * @typedef {{
 *   [Key in keyof T as Lowercase<Key & string>]: T[Key];
 * }} LowerCaseKeys
 */

export {};
