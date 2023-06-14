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
    removeCopyright: boolean;
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
export type ComplexConfigType = Pick<ConfigType, 'metadata'>;
export type PlainConfigType = Omit<ConfigType, keyof ComplexConfigType>;
export type KebabCase<S extends string> = S extends `${infer C}${infer T}` ? T extends Uncapitalize<T> ? `${Uncapitalize<C>}${KebabCase<T>}` : `${Uncapitalize<C>}-${KebabCase<T>}` : S;
export type KebabCaseKeys<T extends Record<string, unknown>> = { [Key in keyof T as KebabCase<Key & string>]: T[Key]; };
/**
 * <S>
 */
export type LowerCase<S extends string> = Lowercase<S>;
export type LowerCaseKeys<T extends Record<string, unknown>> = { [Key in keyof T as Lowercase<Key & string>]: T[Key]; };
//# sourceMappingURL=exported.d.ts.map