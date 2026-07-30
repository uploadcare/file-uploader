/**
 * Single source of truth for every built-in config option: default value,
 * coercion (`coerce`), and whether the key is attribute-representable.
 *
 * Derived (do not hand-maintain in parallel):
 * - {@link initialConfig} — frozen defaults
 * - {@link normalizeConfigValue} — null-safe coerce + throw → default fallback
 * - {@link BUILTIN_DESCRIPTORS} — host/controller descriptor map
 * - {@link complexConfigKeys} / plain keys — attribute surface
 */
import { type ConfigKeyDescriptor, resolveConfigDescriptor } from '../../abstract/config-descriptor';
import { logger } from '../../abstract/logger';
import type { ConfigType } from '../../types';
import { DEFAULT_CDN_ORIGIN } from '../../utils/cdn/origin';
import { serializeCsv } from '../../utils/comma-separated';
import { ALL_TABS } from '../CloudImageEditor/src/toolbar-constants';
import {
  asArray,
  asBoolean,
  asCameraCapture,
  asCameraMode,
  asCameraModes,
  asDynamicButtonViewMode,
  asFilesViewMode,
  asFunction,
  asMetadata,
  asNumber,
  asObject,
  asPasteScope,
  asStore,
  asString,
} from './validatorsType';

const log = logger.scope('normalize-config-value');

export const DEFAULT_CDN_CNAME = DEFAULT_CDN_ORIGIN;
export const DEFAULT_BASE_URL = 'https://upload.uploadcare.com';
export const DEFAULT_SOCIAL_BASE_URL = 'https://social.uploadcare.com';
export const DEFAULT_PREFIXED_CDN_BASE_DOMAIN = 'https://ucarecd.net';

/** One built-in option: default + throw-on-invalid coerce + attribute flag. */
export type BuiltinOptionDef<T> = {
  readonly default: T;
  /** Coerce a non-nullish raw value. Throws on invalid input. */
  readonly coerce: (value: unknown) => T;
  /**
   * When `false`, the key is not attribute-representable (object/function).
   * Omitted / `true` ⇒ plain attribute key.
   */
  readonly attribute?: boolean;
};

type BuiltinRegistry = { readonly [K in keyof ConfigType]: BuiltinOptionDef<ConfigType[K]> };

/**
 * Exhaustive built-in registry. Adding a `ConfigType` key without an entry here
 * is a compile error (`satisfies BuiltinRegistry`).
 */
export const BUILTIN_REGISTRY = {
  pubkey: { default: '', coerce: asString },
  multiple: { default: true, coerce: asBoolean },
  multipleMin: { default: 0, coerce: asNumber },
  multipleMax: { default: Number.MAX_SAFE_INTEGER, coerce: asNumber },

  confirmUpload: { default: false, coerce: asBoolean },
  imgOnly: { default: false, coerce: asBoolean },
  accept: { default: '', coerce: asString },
  externalSourcesPreferredTypes: { default: '', coerce: asString },
  externalSourcesEmbedCss: { default: '', coerce: asString },
  store: { default: 'auto', coerce: asStore },
  cameraMirror: { default: false, coerce: asBoolean },
  cameraCapture: { default: '', coerce: asCameraCapture },
  sourceList: { default: 'local, url, camera, dropbox, gdrive', coerce: asString },
  topLevelOrigin: { default: '', coerce: asString },
  maxLocalFileSizeBytes: { default: 0, coerce: asNumber },
  thumbSize: { default: 76, coerce: asNumber },
  showEmptyList: { default: false, coerce: asBoolean },
  useLocalImageEditor: { default: false, coerce: asBoolean },
  useCloudImageEditor: { default: true, coerce: asBoolean },
  cloudImageEditorTabs: { default: serializeCsv(ALL_TABS), coerce: asString },
  removeCopyright: { default: false, coerce: asBoolean },
  cropPreset: { default: '', coerce: asString },
  imageShrink: { default: '', coerce: asString },

  modalScrollLock: { default: true, coerce: asBoolean },
  modalBackdropStrokes: { default: false, coerce: asBoolean },

  sourceListWrap: { default: true, coerce: asBoolean },

  remoteTabSessionKey: { default: '', coerce: asString },
  cdnCname: { default: DEFAULT_CDN_CNAME, coerce: asString },
  cdnCnamePrefixed: { default: DEFAULT_PREFIXED_CDN_BASE_DOMAIN, coerce: asString },
  baseUrl: { default: DEFAULT_BASE_URL, coerce: asString },
  socialBaseUrl: { default: DEFAULT_SOCIAL_BASE_URL, coerce: asString },
  secureSignature: { default: '', coerce: asString },
  secureExpire: { default: '', coerce: asString },
  secureDeliveryProxy: { default: '', coerce: asString },
  retryThrottledRequestMaxTimes: { default: 3, coerce: asNumber },
  retryNetworkErrorMaxTimes: { default: 3, coerce: asNumber },
  multipartMinFileSize: { default: 26214400, coerce: asNumber },
  multipartChunkSize: { default: 5242880, coerce: asNumber },
  maxConcurrentRequests: { default: 10, coerce: asNumber },
  multipartMaxConcurrentRequests: { default: 4, coerce: asNumber },
  multipartMaxAttempts: { default: 3, coerce: asNumber },
  checkForUrlDuplicates: { default: false, coerce: asBoolean },
  saveUrlForRecurrentUploads: { default: false, coerce: asBoolean },

  groupOutput: { default: false, coerce: asBoolean },
  userAgentIntegration: { default: '', coerce: asString },
  debug: { default: false, coerce: asBoolean },

  localeName: { default: 'en', coerce: asString },

  metadata: { default: null, coerce: asMetadata, attribute: false },
  secureUploadsExpireThreshold: { default: 10 * 60 * 1000, coerce: asNumber },
  localeDefinitionOverride: { default: null, coerce: asObject, attribute: false },
  secureUploadsSignatureResolver: { default: null, coerce: asFunction, attribute: false },
  secureDeliveryProxyUrlResolver: { default: null, coerce: asFunction, attribute: false },
  iconHrefResolver: { default: null, coerce: asFunction, attribute: false },
  plugins: { default: [], coerce: asArray, attribute: false },
  fileValidators: { default: [], coerce: asArray, attribute: false },
  collectionValidators: { default: [], coerce: asArray, attribute: false },
  validationTimeout: { default: 15 * 1000, coerce: asNumber },
  validationConcurrency: { default: 100, coerce: asNumber },

  cameraModes: { default: 'photo, video', coerce: asCameraModes },
  defaultCameraMode: { default: null, coerce: asCameraMode },
  enableAudioRecording: { default: true, coerce: asBoolean },
  enableVideoRecording: { default: null, coerce: asBoolean },
  mediaRecorderOptions: { default: null, coerce: asObject, attribute: false },

  maxVideoRecordingDuration: { default: null, coerce: asNumber },

  filesViewMode: { default: 'list', coerce: asFilesViewMode },
  gridShowFileNames: { default: false, coerce: asBoolean },
  cloudImageEditorAutoOpen: { default: false, coerce: asBoolean },
  cloudImageEditorMaskHref: { default: null, coerce: asString },

  testMode: { default: false, coerce: asBoolean },

  qualityInsights: { default: true, coerce: asBoolean },
  pasteScope: { default: 'local', coerce: asPasteScope },

  dynamicButtonShowFirstIcon: { default: true, coerce: asBoolean },
  dynamicButtonViewMode: { default: 'auto', coerce: asDynamicButtonViewMode },
} as const satisfies BuiltinRegistry;

type Registry = typeof BUILTIN_REGISTRY;

/** Keys whose values are not attribute-representable (`attribute: false`). */
export type ComplexConfigKey = {
  [K in keyof Registry]: Registry[K] extends { readonly attribute: false } ? K : never;
}[keyof Registry];

export const complexConfigKeys = (Object.entries(BUILTIN_REGISTRY) as [keyof ConfigType, BuiltinOptionDef<unknown>][])
  .filter(([, def]) => def.attribute === false)
  .map(([key]) => key) as ComplexConfigKey[];

// Freeze a plain defaults object for SignalMap / structuredClone consumers.
export const initialConfig: Readonly<ConfigType> = Object.freeze(
  Object.fromEntries(
    (Object.keys(BUILTIN_REGISTRY) as (keyof ConfigType)[]).map((key) => [key, BUILTIN_REGISTRY[key].default]),
  ) as unknown as ConfigType,
);

/**
 * Coerce a raw config write for a built-in key.
 *
 * - `null` / `undefined` → `undefined` (caller treats as clear / use default)
 * - coerce throws → log + fall back to {@link initialConfig} for that key
 *   (built-in policy; custom descriptors keep the previous value instead)
 */
export const normalizeConfigValue = <T extends keyof ConfigType>(key: T, value: unknown): ConfigType[T] | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  try {
    return BUILTIN_REGISTRY[key].coerce(value) as ConfigType[T];
  } catch (reason) {
    log.error(`Invalid value for config key "${key}".`, reason);
    return initialConfig[key];
  }
};

/**
 * Resolved descriptors for every built-in key. Ctx-independent; custom
 * (plugin) descriptors overlay this in {@link ConfigController}.
 *
 * `debug` is listed first so hosts that iterate keys for seed order can log
 * from the start of adoption (same order as the historical `allConfigKeys`).
 */
const orderedBuiltinKeys = [
  'debug',
  ...(Object.keys(BUILTIN_REGISTRY) as (keyof ConfigType)[]).filter((k) => k !== 'debug'),
] as (keyof ConfigType)[];

export const BUILTIN_DESCRIPTORS: ReadonlyMap<string, ConfigKeyDescriptor> = new Map(
  orderedBuiltinKeys.map((key): [string, ConfigKeyDescriptor] => {
    const def = BUILTIN_REGISTRY[key] as BuiltinOptionDef<ConfigType[typeof key]>;
    return [
      key,
      resolveConfigDescriptor({
        name: key,
        defaultValue: def.default,
        attribute: def.attribute !== false,
        normalize: (value: unknown) => normalizeConfigValue(key, value),
      }) as ConfigKeyDescriptor,
    ];
  }),
);
