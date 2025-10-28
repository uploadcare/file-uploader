import type { Metadata, MetadataCallback } from '../../types/index';
import { deserializeCsv } from '../../utils/comma-separated';
import type { ModeCameraType } from '../CameraSource/constants';
import { CameraSourceTypes } from '../CameraSource/constants';
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

const asMetadata = (value: unknown): Metadata | MetadataCallback => {
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Metadata;
  }
  if (typeof value === 'function') {
    return value as MetadataCallback;
  }

  throw new Error('Invalid metadata value. Must be an object or function.');
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

export {
  asArray,
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
};
