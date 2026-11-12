import { isAuthTokenResolver } from '@uploadcare/upload-client';
import type {
  AuthToken,
  CameraConstraints,
  CameraConstraintsResolver,
  Metadata,
  MetadataCallback,
  Tags,
  TagsCallback,
} from '../../types/index';
import { deserializeCsv } from '../../utils/comma-separated';
import { parseAspectRatio } from '../camera/aspectRatio';
import { AUDIO_MODES, AUDIO_QUALITIES, NATIVE_ASPECT_RATIO, RESOLUTIONS } from '../camera/cameraSettings';
import { isVideoFormat } from '../camera/videoFormat';
import { CameraSourceTypes, type ModeCameraType } from '../cameraModes';

/** Where a paste adds files: inside the uploader, anywhere on the page, or nowhere. */
export type PasteScope = 'local' | 'global' | false;
export type DynamicButtonMode = 'auto' | 'menu' | 'toolbar' | 'compact' | 'plain';
export type FilesViewMode = 'grid' | 'list';
export type ModalPresentation = 'modal' | 'inline';

const asString = (value: unknown): string => String(value);

const asNumber = (value: unknown): number => {
  const number = Number(value);
  if (Number.isNaN(number)) {
    throw new Error(`Invalid number: "${value}"`);
  }
  return number;
};

// NEXT-MAJOR(config): read a boolean like an HTML boolean attribute, as the docs describe: only absent or "false" is
// false and any other string ("0", "no", "FALSE") is true, with block flags (`headless`, `dynamic-button`, `dropzone`,
// the `<uc-drop-area>` flags, `textonly`/`icononly`, now Lit `type: Boolean` presence) on the same rule. It waits for
// a major because `store="0"` would start storing files and `headless="false"` would show the button.
// Kept for 1.x compat.
const asBoolean = (value: unknown): boolean => {
  if (typeof value === 'undefined' || value === null) return false;
  if (typeof value === 'boolean') return value;
  // for attr like multiple="true" (react will pass it as string)
  if (value === 'true') return true;
  // for attr flags like multiple="" (some other libs will pass it as empty string)
  if (value === '') return true;
  // for attr like multiple="false" (react will pass it as string)
  if (value === 'false') return false;
  throw new Error(`Invalid boolean: "${value}"`);
};

const asStore = (value: unknown): boolean | 'auto' => (value === 'auto' ? value : asBoolean(value));

/** An option that takes one value out of `allowed`. */
const asOneOf =
  <T extends string>(allowed: readonly T[]) =>
  (value: unknown): T => {
    const str = asString(value);
    const match = allowed.find((item) => item === str);
    if (match === undefined) {
      throw new Error(`Invalid value: "${str}"`);
    }
    return match;
  };

const asCameraCapture = asOneOf(['', 'user', 'environment'] as const);
const asCameraMode = asOneOf(Object.values(CameraSourceTypes));
const asModalPresentation = asOneOf<ModalPresentation>(['modal', 'inline']);
const asFilesViewMode = asOneOf<FilesViewMode>(['grid', 'list']);
const asDynamicButtonViewMode = asOneOf<DynamicButtonMode>(['auto', 'menu', 'toolbar', 'compact', 'plain']);

const asCameraModes = (value: unknown): string => {
  const str = asString(value);
  const array = deserializeCsv(str);
  if (array.some((item) => !Object.values(CameraSourceTypes).includes(item as ModeCameraType))) {
    throw new Error(`Invalid value: "${JSON.stringify(array)}"`);
  }
  return str;
};

const asPasteScope = (value: unknown): PasteScope => {
  const strValue = asString(value);
  if (strValue === 'local' || strValue === 'global') {
    return strValue as PasteScope;
  }
  if (asBoolean(value) === false) {
    return false;
  }

  throw new Error(`Invalid value: "${strValue}"`);
};

const asMetadata = (value: unknown): Metadata | MetadataCallback => {
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Metadata;
  }
  if (typeof value === 'function') {
    return value as MetadataCallback;
  }

  throw new Error('Invalid metadata value. Must be an object or function.');
};

const asTags = (value: unknown): Tags | TagsCallback => {
  if (Array.isArray(value)) {
    return value as Tags;
  }
  if (typeof value === 'function') {
    return value as TagsCallback;
  }

  throw new Error('Invalid tags value. Must be an array or function.');
};

const asAuthToken = (value: unknown): AuthToken => {
  // A provider (`{ getToken, invalidate }`, an `AuthTokenCache` among them) is
  // as valid as a plain token or a resolver. `isAuthTokenResolver` is the same
  // guard upload-client uses to tell the callable forms from a string, so the
  // two ends of the handoff cannot drift apart.
  if (typeof value === 'string' || isAuthTokenResolver(value as AuthToken)) {
    return value as AuthToken;
  }

  throw new Error('Invalid authToken value. Must be a string, a function, or a `{ getToken }` object.');
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asCameraConstraints = (value: unknown): CameraConstraints | CameraConstraintsResolver => {
  if (typeof value === 'function') {
    return value as CameraConstraintsResolver;
  }
  if (isPlainObject(value)) {
    // `audio: false` or `video: true` are valid for getUserMedia but not here, and would be ignored without a word.
    for (const kind of ['video', 'audio'] as const) {
      if (value[kind] !== undefined && !isPlainObject(value[kind])) {
        throw new Error(`Invalid cameraConstraints.${kind} value. Must be an object of track constraints.`);
      }
    }
    return value as CameraConstraints;
  }

  throw new Error('Invalid cameraConstraints value. Must be an object or a function.');
};

const asCameraVideoFormats = (value: unknown): string => {
  const str = asString(value);
  const invalid = deserializeCsv(str).filter((item) => !isVideoFormat(item));
  if (invalid.length > 0) {
    throw new Error(`Invalid value: "${JSON.stringify(invalid)}"`);
  }
  return str;
};

/**
 * A camera option that takes one value, or a comma-separated list of them for a picker. It needs at least one: an
 * empty list has no default.
 */
const asCameraChoice =
  (allowed: readonly string[]) =>
  (value: unknown): string => {
    const str = asString(value);
    const items = deserializeCsv(str);
    if (items.length === 0 || items.some((item) => !allowed.includes(item))) {
      throw new Error(`Invalid value: "${str}"`);
    }
    return str;
  };

const asCameraResolution = asCameraChoice(RESOLUTIONS);
const asCameraAudioQuality = asCameraChoice(AUDIO_QUALITIES);
const asCameraAudioMode = asCameraChoice(AUDIO_MODES);

/** `cameraAspectRatio`: empty for the native shape, or `"w:h"` ratios and `native`, one or a list. */
const asCameraAspectRatio = (value: unknown): string => {
  const str = asString(value).trim();
  for (const item of deserializeCsv(str)) {
    if (item !== NATIVE_ASPECT_RATIO) {
      parseAspectRatio(item);
    }
  }
  return str;
};

const asCameraPhotoQuality = (value: unknown): number => {
  // `Number('')` is 0, which would encode the photo at the lowest quality.
  if (typeof value === 'string' && value.trim() === '') {
    throw new Error('Must be a number between 0 and 1, got an empty value');
  }
  const number = asNumber(value);
  if (number < 0 || number > 1) {
    throw new Error(`Must be between 0 and 1, got ${number}`);
  }
  return number;
};

const asObject = <T>(value: unknown): T => {
  if (typeof value === 'object') {
    return value as T;
  }

  throw new Error('Invalid value. Must be an object.');
};

const asFunction = <T>(value: unknown): T => {
  if (typeof value === 'function') {
    return value as T;
  }

  throw new Error('Invalid value. Must be a function.');
};

const asArray = <T>(value: unknown): T => {
  if (Array.isArray(value)) {
    return value as T;
  }

  throw new Error('Must be an array.');
};

export {
  asArray,
  asAuthToken,
  asBoolean,
  asCameraAspectRatio,
  asCameraAudioMode,
  asCameraAudioQuality,
  asCameraCapture,
  asCameraConstraints,
  asCameraPhotoQuality,
  asCameraResolution,
  asCameraVideoFormats,
  asCameraMode,
  asCameraModes,
  asFilesViewMode,
  asFunction,
  asMetadata,
  asModalPresentation,
  asNumber,
  asObject,
  asStore,
  asString,
  asTags,
  asPasteScope,
  asDynamicButtonViewMode,
};
