import { UploadcareFile, UploadClientError } from '@uploadcare/upload-client';

/** @enum {{ type; value }} */
export const uploadEntrySchema = Object.freeze({
  file: {
    type: File,
    value: null,
  },
  externalUrl: {
    type: String,
    value: null,
  },
  fileName: {
    type: String,
    value: null,
  },
  fileSize: {
    type: Number,
    value: null,
  },
  lastModified: {
    type: Number,
    value: Date.now(),
  },
  uploadProgress: {
    type: Number,
    value: 0,
  },
  uuid: {
    type: String,
    value: null,
  },
  isImage: {
    type: Boolean,
    value: false,
  },
  mimeType: {
    type: String,
    value: null,
  },
  uploadError: {
    type: UploadClientError,
    value: null,
  },
  validationErrorMsg: {
    type: String,
    value: null,
  },
  ctxName: {
    type: String,
    value: null,
  },
  transformationsUrl: {
    type: String,
    value: null,
  },
  fileInfo: {
    type: UploadcareFile,
    value: null,
  },
});
