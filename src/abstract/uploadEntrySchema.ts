import type { Metadata, UploadcareFile } from '@uploadcare/upload-client';
import type { OutputErrorFile } from '../types/index';
import type { TypedData } from './TypedData';

export interface UploadEntryData extends Record<string, unknown> {
  file: File | null;
  externalUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  lastModified: number;
  uploadProgress: number;
  uuid: string | null;
  isImage: boolean;
  mimeType: string | null;
  ctxName: string | null;
  cdnUrl: string | null;
  cdnUrlModifiers: string | null;
  fileInfo: UploadcareFile | null;
  isUploading: boolean;
  abortController: AbortController | null;
  thumbUrl: string | null;
  silent: boolean;
  source: string | null;
  fullPath: string | null;
  metadata: Metadata | null;
  errors: OutputErrorFile[];
  uploadError: Error | null;
  isRemoved: boolean;
  isQueuedForUploading: boolean;
  isValidationPending: boolean;
  isQueuedForValidation: boolean;
}

export const initialUploadEntryData: UploadEntryData = {
  file: null,
  externalUrl: null,
  fileName: null,
  fileSize: null,
  lastModified: Date.now(),
  uploadProgress: 0,
  uuid: null,
  isImage: false,
  mimeType: null,
  ctxName: null,
  cdnUrl: null,
  cdnUrlModifiers: null,
  fileInfo: null,
  isUploading: false,
  abortController: null,
  thumbUrl: null,
  silent: false,
  source: null,
  fullPath: null,
  metadata: null,
  errors: [],
  uploadError: null,
  isRemoved: false,
  isQueuedForUploading: false,
  isValidationPending: false,
  isQueuedForValidation: false,
};

export type UploadEntryTypedData = TypedData<UploadEntryData>;

export type UploadEntryKeys = keyof UploadEntryData;
