import { UploadcareFile } from '@uploadcare/upload-client';

export type Metadata = import('@uploadcare/upload-client').Metadata;
export type MetadataCallback = () => Promise<Metadata>;
export type ConfigType = {
  pubkey: string;
  multiple: boolean;
  multipleMin: number;
  multipleMax: number;
  confirmUpload: boolean;
  imgOnly: boolean;
  accept: string;
  externalSourcesPreferredTypes: string;
  store: boolean | 'auto';
  cameraMirror: boolean;
  sourceList: string;
  maxLocalFileSizeBytes: number;
  thumbSize: number;
  showEmptyList: boolean;
  useLocalImageEditor: boolean;
  useCloudImageEditor: boolean;
  cloudImageEditorTabs: string;
  removeCopyright: boolean;
  cropPreset: string;
  modalScrollLock: boolean;
  modalBackdropStrokes: boolean;
  sourceListWrap: boolean;
  remoteTabSessionKey: string;
  cdnCname: string;
  baseUrl: string;
  socialBaseUrl: string;
  secureSignature: string;
  secureExpire: string;
  secureDeliveryProxy: string;
  retryThrottledRequestMaxTimes: number;
  multipartMinFileSize: number;
  multipartChunkSize: number;
  maxConcurrentRequests: number;
  multipartMaxConcurrentRequests: number;
  multipartMaxAttempts: number;
  checkForUrlDuplicates: boolean;
  saveUrlForRecurrentUploads: boolean;
  groupOutput: boolean;
  userAgentIntegration: string;
  metadata: Metadata | MetadataCallback | null;
};
export type ConfigComplexType = Pick<ConfigType, 'metadata'>;
export type ConfigPlainType = Omit<ConfigType, keyof ConfigComplexType>;
export type ConfigAttributesType = KebabCaseKeys<ConfigPlainType> & LowerCaseKeys<ConfigPlainType>;

export type KebabCase<S extends string> = S extends `${infer C}${infer T}`
  ? T extends Uncapitalize<T>
    ? `${Uncapitalize<C>}${KebabCase<T>}`
    : `${Uncapitalize<C>}-${KebabCase<T>}`
  : S;
export type KebabCaseKeys<T extends Record<string, unknown>> = { [Key in keyof T as KebabCase<Key & string>]: T[Key] };
export type LowerCase<S extends string> = Lowercase<S>;
export type LowerCaseKeys<T extends Record<string, unknown>> = { [Key in keyof T as Lowercase<Key & string>]: T[Key] };

type requiredFileInfoFields = 'name' | 'size' | 'isImage' | 'mimeType';

export type OutputFileEntry = Pick<UploadcareFile, requiredFileInfoFields> &
  Partial<Omit<UploadcareFile, requiredFileInfoFields>> & {
    cdnUrlModifiers: string | null;
    validationErrorMessage: string | null;
    uploadError: Error | null;
    file: File | Blob | null;
    externalUrl: string | null;
    isValid: boolean;
    isUploaded: boolean;
    fullPath: string | null
  };

export {};
