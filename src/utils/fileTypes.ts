import { browserInfo } from './browser-info';
import { stringToArray } from './stringToArray';

export const BASIC_IMAGE_WILDCARD = 'image/*' as const;
export const BASIC_VIDEO_WILDCARD = 'video/*' as const;
export const HEIC_IMAGE_MIME_LIST = [
  'image/heif',
  'image/heif-sequence',
  'image/heic',
  'image/heic-sequence',
  'image/avif',
  'image/avif-sequence',
  '.heif',
  '.heifs',
  '.heic',
  '.heics',
  '.avif',
  '.avifs',
] as const;

export const calcImageAcceptList = (): string[] => {
  // Desktop Safari allows selecting HEIC images with simple image/* wildcard
  // But if we provide a more specific HEIC types - safari starts to convert any images to HEIC
  if (browserInfo.safariDesktop) {
    return [BASIC_IMAGE_WILDCARD];
  }
  // Other browsers allows to select HEIC images with more specific HEIC types only
  // Mobile Safari will allow to select HEIC images even with simple image/* wildcard and it will convert them to JPEG by default (behaviour could be changed in file picker UI)
  // Hope it will be fixed in the future so we'll add specific types so that Mobile Safari will know that we're supporting HEIC images
  return [BASIC_IMAGE_WILDCARD, ...HEIC_IMAGE_MIME_LIST];
};

export const IMAGE_ACCEPT_LIST = calcImageAcceptList();

export const mergeFileTypes = (fileTypes?: string[]): string[] => {
  if (!fileTypes) {
    return [];
  }
  return fileTypes.filter((item): item is string => typeof item === 'string').flatMap((str) => stringToArray(str));
};

export const matchMimeType = (mimeType: string, allowedFileTypes: string[]): boolean => {
  return allowedFileTypes.some((type) => {
    if (type.endsWith('*')) {
      const normalizedType = type.replace('*', '');
      return mimeType.startsWith(normalizedType);
    }

    return mimeType === type;
  });
};

export const matchExtension = (fileName: string, allowedFileTypes: string[]): boolean => {
  return allowedFileTypes.some((type) => {
    if (!type.startsWith('.')) {
      return false;
    }

    return fileName.toLowerCase().endsWith(type.toLowerCase());
  });
};

export const fileIsImage = (file: File | Blob): boolean => {
  const type = file?.type;
  if (!type) {
    return false;
  }
  return matchMimeType(type, IMAGE_ACCEPT_LIST);
};

export const isBlob = (data: unknown): data is Blob => {
  return typeof Blob !== 'undefined' && data instanceof Blob;
};

export const isFile = (data: unknown): data is File => {
  return typeof File !== 'undefined' && data instanceof File;
};
