import { UploadcareFile } from '@uploadcare/upload-client';
import type { OutputErrorFile } from '../types/index';
import type { ExtractDataFromSchema, ExtractKeysFromSchema, TypedData } from './TypedData';

export const uploadEntrySchema = Object.freeze({
  file: Object.freeze({
    type: File,
    value: null,
    nullable: true,
  }),
  externalUrl: Object.freeze({
    type: String,
    value: null,
    nullable: true,
  }),
  fileName: Object.freeze({
    type: String,
    value: null,
    nullable: true,
  }),
  fileSize: Object.freeze({
    type: Number,
    value: null,
    nullable: true,
  }),
  lastModified: Object.freeze({
    type: Number,
    value: Date.now(),
  }),
  uploadProgress: Object.freeze({
    type: Number,
    value: 0,
  }),
  uuid: Object.freeze({
    type: String,
    value: null,
    nullable: true,
  }),
  isImage: Object.freeze({
    type: Boolean,
    value: false,
  }),
  mimeType: Object.freeze({
    type: String,
    value: null,
    nullable: true,
  }),
  ctxName: Object.freeze({
    type: String,
    value: null,
    nullable: true,
  }),
  cdnUrl: Object.freeze({
    type: String,
    value: null,
    nullable: true,
  }),
  cdnUrlModifiers: Object.freeze({
    type: String,
    value: null,
    nullable: true,
  }),
  fileInfo: Object.freeze({
    type: UploadcareFile,
    value: null,
    nullable: true,
  }),
  isUploading: Object.freeze({
    type: Boolean,
    value: false,
  }),
  abortController: Object.freeze({
    type: AbortController,
    value: null,
    nullable: true,
  }),
  thumbUrl: Object.freeze({
    type: String,
    value: null,
    nullable: true,
  }),
  silent: Object.freeze({
    type: Boolean,
    value: false,
  }),
  source: Object.freeze({
    type: String,
    value: null,
    nullable: true,
  }),
  fullPath: Object.freeze({
    type: String,
    value: null,
    nullable: true,
  }),
  metadata: Object.freeze({
    type: Object,
    value: null,
    nullable: true,
  }),
  errors: Object.freeze({
    type: Array,
    value: [] as OutputErrorFile[],
  }),
  uploadError: Object.freeze({
    type: Error,
    value: null,
    nullable: true,
  }),
  isRemoved: Object.freeze({
    type: Boolean,
    value: false,
  }),
  isQueuedForUploading: Object.freeze({
    type: Boolean,
    value: false,
  }),
  isValidationPending: Object.freeze({
    type: Boolean,
    value: false,
  }),
  isQueuedForValidation: Object.freeze({
    type: Boolean,
    value: false,
  }),
});

export type UploadEntryData = ExtractDataFromSchema<typeof uploadEntrySchema>;

export type UploadEntryTypedData = TypedData<typeof uploadEntrySchema>;

export type UploadEntryKeys = ExtractKeysFromSchema<typeof uploadEntrySchema>;
