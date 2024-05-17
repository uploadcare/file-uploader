// @ts-check
import { NetworkError, UploadError } from '@uploadcare/upload-client';
import { buildCollectionFileError, buildOutputFileError } from '../utils/buildOutputError.js';
import { EventType } from '../blocks/UploadCtxProvider/EventEmitter.js';
import { IMAGE_ACCEPT_LIST, matchExtension, matchMimeType, mergeFileTypes } from '../utils/fileTypes.js';
import { prettyBytes } from '../utils/prettyBytes.js';
import { TypedCollection } from './TypedCollection.js';

export class ValidationManager {
  /**
   * @private
   * @type {import('./UploaderBlock.js').UploaderBlock | null}
   */
  _blockInstance = null;

  /**
   * @private
   * @type {((
   *   outputEntry: import('../types').OutputFileEntry,
   *   internalEntry?: import('./TypedData.js').TypedData,
   * ) => undefined | ReturnType<typeof import('../utils/buildOutputError.js').buildOutputFileError>)[]}
   */
  _fileValidators = [
    this._validateIsImage.bind(this),
    this._validateFileType.bind(this),
    this._validateMaxSizeLimit.bind(this),
    this._validateUploadError.bind(this),
  ];

  /**
   * @private
   * @type {((
   *   collection: TypedCollection,
   * ) =>
   *   | undefined
   *   | ReturnType<typeof import('../utils/buildOutputError.js').buildCollectionFileError>
   *   | ReturnType<typeof import('../utils/buildOutputError.js').buildCollectionFileError>[])[]}
   */
  _collectionValidators = [
    (collection) => {
      const total = collection.size;
      const multipleMin = this._blockInstance.cfg.multiple ? this._blockInstance.cfg.multipleMin : 0;
      const multipleMax = this._blockInstance.cfg.multiple ? this._blockInstance.cfg.multipleMax : 1;

      if (multipleMin && total < multipleMin) {
        const message = this._blockInstance.l10n('files-count-limit-error-too-few', {
          min: multipleMin,
          max: multipleMax,
          total,
        });
        return buildCollectionFileError({
          type: 'TOO_FEW_FILES',
          message,
          total,
          min: multipleMin,
          max: multipleMax,
        });
      }

      if (multipleMax && total > multipleMax) {
        const message = this._blockInstance.l10n('files-count-limit-error-too-many', {
          min: multipleMin,
          max: multipleMax,
          total,
        });
        return buildCollectionFileError({
          type: 'TOO_MANY_FILES',
          message,
          total,
          min: multipleMin,
          max: multipleMax,
        });
      }
    },
    (collection) => {
      if (collection.items().some((id) => collection.readProp(id, 'errors').length > 0)) {
        return buildCollectionFileError({
          type: 'SOME_FILES_HAS_ERRORS',
          message: this._blockInstance.l10n('some-files-were-not-uploaded'),
        });
      }
    },
  ];

  /** @param {import('./UploaderBlock.js').UploaderBlock} blockInstance */
  constructor(blockInstance) {
    this._blockInstance = blockInstance;

    const runAllValidators = () => {
      this._runFileValidators();
      this._runCollectionValidators();
    };

    this._blockInstance.subConfigValue('maxLocalFileSizeBytes', runAllValidators);
    this._blockInstance.subConfigValue('multipleMin', runAllValidators);
    this._blockInstance.subConfigValue('multipleMax', runAllValidators);
    this._blockInstance.subConfigValue('multiple', runAllValidators);
    this._blockInstance.subConfigValue('imgOnly', runAllValidators);
    this._blockInstance.subConfigValue('accept', runAllValidators);
  }

  /**
   * @private
   * @param {string[]} [entryIds]
   */
  _runFileValidators(entryIds) {
    const ids = entryIds ?? this._blockInstance.uploadCollection.items();
    for (const id of ids) {
      const entry = this._blockInstance.uploadCollection.read(id);
      entry && this._runFileValidatorsForEntry(entry);
    }
  }

  /** @private */
  _runCollectionValidators() {
    const collection = this._blockInstance.uploadCollection;
    const errors = [];

    for (const validator of this._collectionValidators) {
      const errorOrErrors = validator(collection);
      if (!errorOrErrors) {
        continue;
      }
      if (Array.isArray(errorOrErrors)) {
        errors.push(...errorOrErrors);
      } else {
        errors.push(errorOrErrors);
      }
    }

    this._blockInstance.$['*collectionErrors'] = errors;

    if (errors.length > 0) {
      this._blockInstance.emit(
        EventType.COMMON_UPLOAD_FAILED,
        () =>
          /** @type {import('../types').OutputCollectionState<'failed'>} */ (
            this._blockInstance.getOutputCollectionState()
          ),
        { debounce: true },
      );
    }
  }

  /**
   * @private
   * @param {import('./TypedData.js').TypedData} entry
   */
  _runFileValidatorsForEntry(entry) {
    const outputEntry = this._blockInstance.getOutputItem(entry.uid);
    const errors = [];

    for (const validator of this._fileValidators) {
      const error = validator(outputEntry, entry);
      if (error) {
        errors.push(error);
      }
    }
    entry.setValue('errors', errors);
  }

  /**
   * @private
   * @param {import('../types').OutputFileEntry} outputEntry
   */
  _validateIsImage(outputEntry) {
    const imagesOnly = this._blockInstance.cfg.imgOnly;
    const isImage = outputEntry.isImage;

    if (!imagesOnly || isImage) {
      return;
    }
    if (!outputEntry.fileInfo && outputEntry.externalUrl) {
      // skip validation for not uploaded files with external url, cause we don't know if they're images or not
      return;
    }
    if (!outputEntry.fileInfo && !outputEntry.mimeType) {
      // skip validation for not uploaded files without mime-type, cause we don't know if they're images or not
      return;
    }

    return buildOutputFileError({
      type: 'NOT_AN_IMAGE',
      message: this._blockInstance.l10n('images-only-accepted'),
      entry: outputEntry,
    });
  }

  /**
   * @private
   * @param {import('../types').OutputFileEntry} outputEntry
   */
  _validateFileType(outputEntry) {
    const imagesOnly = this._blockInstance.cfg.imgOnly;
    const accept = this._blockInstance.cfg.accept;
    const allowedFileTypes = mergeFileTypes([...(imagesOnly ? IMAGE_ACCEPT_LIST : []), accept]);
    if (!allowedFileTypes.length) return;

    const mimeType = outputEntry.mimeType;
    const fileName = outputEntry.name;

    if (!mimeType || !fileName) {
      // Skip client validation if mime type or file name are not available for some reasons
      return;
    }

    const mimeOk = matchMimeType(mimeType, allowedFileTypes);
    const extOk = matchExtension(fileName, allowedFileTypes);

    if (!mimeOk && !extOk) {
      // Assume file type is not allowed if both mime and ext checks fail
      return buildOutputFileError({
        type: 'FORBIDDEN_FILE_TYPE',
        message: this._blockInstance.l10n('file-type-not-allowed'),
        entry: outputEntry,
      });
    }
  }

  /**
   * @private
   * @param {import('../types').OutputFileEntry} outputEntry
   */
  _validateMaxSizeLimit(outputEntry) {
    const maxFileSize = this._blockInstance.cfg.maxLocalFileSizeBytes;
    const fileSize = outputEntry.size;
    if (maxFileSize && fileSize && fileSize > maxFileSize) {
      return buildOutputFileError({
        type: 'FILE_SIZE_EXCEEDED',
        message: this._blockInstance.l10n('files-max-size-limit-error', { maxFileSize: prettyBytes(maxFileSize) }),
        entry: outputEntry,
      });
    }
  }

  /**
   * @private
   * @param {import('../types').OutputFileEntry} outputEntry
   * @param {import('./TypedData.js').TypedData} [internalEntry]
   */
  _validateUploadError(outputEntry, internalEntry) {
    /** @type {unknown} */
    const cause = internalEntry?.getValue('uploadError');
    if (!cause) {
      return;
    }

    if (cause instanceof UploadError) {
      return buildOutputFileError({
        type: 'UPLOAD_ERROR',
        message: cause.message,
        entry: outputEntry,
        error: cause,
      });
    } else if (cause instanceof NetworkError) {
      return buildOutputFileError({
        type: 'NETWORK_ERROR',
        message: cause.message,
        entry: outputEntry,
        error: cause,
      });
    } else {
      const error = cause instanceof Error ? cause : new Error('Unknown error', { cause });
      return buildOutputFileError({
        type: 'UNKNOWN_ERROR',
        message: error.message,
        entry: outputEntry,
        error,
      });
    }
  }
}
