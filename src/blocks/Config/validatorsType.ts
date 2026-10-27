import { isAuthTokenResolver } from '@uploadcare/upload-client';
import type { PasteScope } from '../../abstract/features/ClipboardLayer';
import type {
  AuthToken,
  CameraConstraints,
  CameraConstraintsResolver,
  CameraQuality,
  Metadata,
  MetadataCallback,
  Tags,
  TagsCallback,
} from '../../types/index';
import { deserializeCsv } from '../../utils/comma-separated';
import { parseAspectRatio } from '../CameraSource/aspectRatio';
import type { ModeCameraType } from '../CameraSource/constants';
import { CameraSourceTypes } from '../CameraSource/constants';
import { isVideoFormat } from '../CameraSource/videoFormat';
import type { DynamicButtonMode } from '../DynamicBtn/DynamicBtn';
import type { FilesViewMode } from '../UploadList/UploadList';

const asString = (value: unknown): string => String(value);

const asNumber = (value: unknown): number => {
  const number = Number(value);
  if (Number.isNaN(number)) {
    throw new Error(`Invalid number: "${value}"`);
  }
  return number;
};

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

const asCameraCapture = (value: unknown): '' | 'user' | 'environment' => {
  const strValue = asString(value);
  if (strValue !== 'user' && strValue !== 'environment' && strValue !== '') {
    throw new Error(`Invalid value: "${strValue}"`);
  }
  return strValue;
};

const asCameraMode = (value: unknown): ModeCameraType => {
  const strValue = asString(value);
  if (!Object.values(CameraSourceTypes).includes(strValue as ModeCameraType)) {
    throw new Error(`Invalid value: "${strValue}"`);
  }
  return strValue as ModeCameraType;
};

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

const asCameraConstraints = (value: unknown): CameraConstraints | CameraConstraintsResolver => {
  if (typeof value === 'function') {
    return value as CameraConstraintsResolver;
  }
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as CameraConstraints;
  }

  throw new Error('Invalid cameraConstraints value. Must be an object or a function.');
};

const asCameraAspectRatio = (value: unknown): string => {
  const strValue = asString(value).trim();
  parseAspectRatio(strValue);
  return strValue;
};

const CAMERA_QUALITIES: readonly string[] = ['auto', '720p', '1080p', '4k'] satisfies CameraQuality[];

const asCameraQuality = (value: unknown): CameraQuality => {
  const strValue = asString(value);
  if (CAMERA_QUALITIES.includes(strValue)) {
    return strValue as CameraQuality;
  }
  throw new Error(`Invalid value: "${strValue}"`);
};

const asCameraVideoFormats = (value: unknown): string => {
  const str = asString(value);
  const invalid = deserializeCsv(str).filter((item) => !isVideoFormat(item));
  if (invalid.length > 0) {
    throw new Error(`Invalid value: "${JSON.stringify(invalid)}"`);
  }
  return str;
};

const asCameraAspectRatioOptions = (value: unknown): string => {
  const str = asString(value);
  for (const item of deserializeCsv(str)) {
    if (item !== 'native') {
      parseAspectRatio(item);
    }
  }
  return str;
};

const asCameraQualityOptions = (value: unknown): string => {
  const str = asString(value);
  const invalid = deserializeCsv(str).filter((item) => !CAMERA_QUALITIES.includes(item));
  if (invalid.length > 0) {
    throw new Error(`Invalid value: "${JSON.stringify(invalid)}"`);
  }
  return str;
};

const asCameraPhotoQuality = (value: unknown): number => {
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

const asFilesViewMode = (value: unknown): FilesViewMode => {
  const strValue = asString(value);

  if (['grid', 'list'].includes(strValue)) {
    return strValue as FilesViewMode;
  }

  throw new Error(`Invalid value: "${strValue}"`);
};

const asDynamicButtonViewMode = (value: unknown): DynamicButtonMode => {
  const strValue = asString(value);
  if (['auto', 'menu', 'toolbar', 'compact', 'plain'].includes(strValue)) {
    return strValue as DynamicButtonMode;
  }
  throw new Error(`Invalid value: "${strValue}"`);
};

export {
  asArray,
  asAuthToken,
  asBoolean,
  asCameraAspectRatio,
  asCameraAspectRatioOptions,
  asCameraCapture,
  asCameraConstraints,
  asCameraPhotoQuality,
  asCameraQuality,
  asCameraQualityOptions,
  asCameraVideoFormats,
  asCameraMode,
  asCameraModes,
  asFilesViewMode,
  asFunction,
  asMetadata,
  asNumber,
  asObject,
  asStore,
  asString,
  asTags,
  asPasteScope,
  asDynamicButtonViewMode,
};
