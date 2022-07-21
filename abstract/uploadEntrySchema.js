import { UploadcareFile } from '@uploadcare/upload-client';

/**
 * @typedef {Object} UploadEntry
 * @property {File} file
 * @property {String} externalUrl
 * @property {String} fileName
 * @property {number} fileSize
 * @property {number} lastModified
 * @property {number} uploadProgress
 * @property {String} uuid
 * @property {Boolean} isImage
 * @property {String} mimeType
 * @property {Error} uploadError
 * @property {String} uploadErrorMsg
 * @property {String} validationErrorMsg
 * @property {String} ctxName
 * @property {String} cdnUrl
 * @property {String} cdnUrlModifiers
 * @property {import('../blocks/CloudImageEditor/src/types.js').Transformations} editorTransformations
 * @property {UploadcareFile} fileInfo
 * @property {Boolean} isUploading
 */

/** @type {{ [key in keyof UploadEntry]: { type; value; nullable?: Boolean } }} */
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
    // TODO: there could be Error or UploadcareClientError
    type: Error,
    value: null,
    nullable: true,
  },
  uploadErrorMsg: {
    type: String,
    value: null,
    nullable: true,
  },
  validationErrorMsg: {
    type: String,
    value: null,
    nullable: true,
  },
  ctxName: {
    type: String,
    value: null,
  },
  cdnUrl: {
    type: String,
    value: null,
  },
  cdnUrlModifiers: {
    type: String,
    value: null,
  },
  editorTransformations: {
    type: Object,
    value: null,
  },
  fileInfo: {
    type: UploadcareFile,
    value: null,
  },
  isUploading: {
    type: Boolean,
    value: false,
  },
});
