import type { Metadata, UploadcareFile } from '@uploadcare/upload-client';
import type { OutputErrorFile } from '../types/exported';

/**
 * v2 schema for a single upload entry. Owned by v2 — no `ctxName`, no
 * v1-specific fields. Replaces v1's `UploadEntryData` for all v2
 * consumers; v1 only sees this shape through the
 * `UploadCollectionController` bridge.
 */
export interface UploadEntryFields {
  file: File | null;
  externalUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  lastModified: number;
  uploadProgress: number;
  uuid: string | null;
  isImage: boolean;
  mimeType: string | null;
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

export const initialEntryFields: UploadEntryFields = {
  file: null,
  externalUrl: null,
  fileName: null,
  fileSize: null,
  lastModified: Date.now(),
  uploadProgress: 0,
  uuid: null,
  isImage: false,
  mimeType: null,
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

export type UploadEntryFieldKey = keyof UploadEntryFields;
