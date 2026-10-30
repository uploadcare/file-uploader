import { isAuthTokenResolver } from '@uploadcare/upload-client';
import type { AuthToken, Metadata, MetadataCallback, Tags, TagsCallback } from '../../types/index';
import { parseBooleanAttribute } from '../../utils/boolean-attribute';
import { deserializeCsv } from '../../utils/comma-separated';
import { CameraSourceTypes, type ModeCameraType } from '../cameraModes';

/** Where a paste adds files: inside the uploader, anywhere on the page, or nowhere. */
export type PasteScope = 'local' | 'global' | false;
export type DynamicButtonMode = 'auto' | 'menu' | 'toolbar' | 'compact' | 'plain';
export type FilesViewMode = 'grid' | 'list';

const asString = (value: unknown): string => String(value);

const asNumber = (value: unknown): number => {
  const number = Number(value);
  if (Number.isNaN(number)) {
    throw new Error(`Invalid number: "${value}"`);
  }
  return number;
};

const asBoolean = (value: unknown): boolean => {
  // Attribute values are strings: the shared boolean-attribute rule (documented).
  if (typeof value === 'string') return parseBooleanAttribute(value);
  return Boolean(value);
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
  asCameraCapture,
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
