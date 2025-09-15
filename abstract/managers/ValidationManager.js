// @ts-check
import { EventType } from '../../blocks/UploadCtxProvider/EventEmitter.js';
import {
  validateIsImage,
  validateFileType,
  validateMaxSizeLimit,
  validateUploadError,
} from '../../utils/validators/file/index.js';
import { validateMultiple, validateCollectionUploadError } from '../../utils/validators/collection/index.js';
import { Queue } from '@uploadcare/upload-client';
import { withResolvers } from '../../utils/withResolvers.js';
import { debounce } from '../../blocks/utils/debounce.js';

/**
 * @typedef {(
 *   outputEntry: import('../../types').OutputFileEntry,
 *   api: import('../UploaderPublicApi.js').UploaderPublicApi,
 *   options?: { signal?: AbortSignal },
 * ) =>
 *   | (undefined | import('../../types').OutputErrorFile)
 *   | Promise<undefined | import('../../types').OutputErrorFile>} FuncFileValidator
 */

/**
 * @typedef {{
 *   runOn: 'add' | 'upload' | 'change';
 *   validator: FuncFileValidator;
 * }} FileValidatorDescriptor
 */

/** @typedef {FileValidatorDescriptor | FuncFileValidator} FileValidator */

/**
 * @typedef {(
 *   collection: ReturnType<
 *     typeof import('../buildOutputCollectionState.js').buildOutputCollectionState<
 *       import('../../types').OutputCollectionStatus
 *     >
 *   >,
 *   api: import('../UploaderPublicApi.js').UploaderPublicApi,
 * ) => undefined | import('../../types').OutputErrorCollection} FuncCollectionValidator
 */

const LOG_TEXT = {
  FILE_VALIDATION_FAILED: 'File validator execution has failed',
  FILE_VALIDATION_TIMEOUT: 'File validator execution has timed out',
  COLLECTION_VALIDATION_FAILED: 'Collection validator execution has failed',
  MISSING_ERROR_MESSAGE: 'Missing message. We recommend adding message: value.',
};

/**
 * @param {FileValidator} validator
 * @returns {FileValidatorDescriptor}
 */
const getValidatorDescriptor = (validator) => {
  if (typeof validator === 'function') {
    return { runOn: 'change', validator };
  }
  return validator;
};

export class ValidationManager {
  /**
   * @private
   * @type {import('../UploaderBlock.js').UploaderBlock}
   */
  _blockInstance;

  /** @type {FuncFileValidator[]} */
  _commonFileValidators = [validateIsImage, validateFileType, validateMaxSizeLimit, validateUploadError];

  /** @type {FuncCollectionValidator[]} */
  _commonCollectionValidators = [validateMultiple, validateCollectionUploadError];

  _queue = new Queue(20);
  _runQueueDebounced = debounce(() => {
    this._queue.run();
  }, 500);

  /**
   * @type {Map<
   *   string,
   *   {
   *     abortController?: AbortController;
   *     skippedValidators: WeakSet<FuncFileValidator>;
   *     promise?: Promise<void>;
   *     lastErrorThrownByValidator: WeakMap<FuncFileValidator, import('../../types').OutputErrorFile | undefined>;
   *   }
   * >}
   */
  _entryValidationState = new Map();

  /** @param {import('../UploaderBlock.js').UploaderBlock} blockInstance */
  constructor(blockInstance) {
    this._blockInstance = blockInstance;

    this._uploadCollection = this._blockInstance.uploadCollection;

    const runAllValidators = () => {
      this.runFileValidators('change');
      this.runCollectionValidators();
    };

    this._blockInstance.subConfigValue('maxLocalFileSizeBytes', runAllValidators);
    this._blockInstance.subConfigValue('multipleMin', runAllValidators);
    this._blockInstance.subConfigValue('multipleMax', runAllValidators);
    this._blockInstance.subConfigValue('multiple', runAllValidators);
    this._blockInstance.subConfigValue('imgOnly', runAllValidators);
    this._blockInstance.subConfigValue('accept', runAllValidators);

    this._blockInstance.subConfigValue('validationConcurrency', (concurrency) => {
      this._queue.concurrency = concurrency;
    });
  }

  /**
   * @param {FileValidatorDescriptor['runOn']} runOn
   * @param {string[]} [entryIds]
   */
  runFileValidators(runOn, entryIds) {
    const ids = entryIds ?? this._uploadCollection.items();
    for (const id of ids) {
      const entry = this._uploadCollection.read(id);
      if (entry) {
        void this._runFileValidatorsForEntry(entry, runOn);
      }
    }
  }

  runCollectionValidators() {
    const collection = this._blockInstance.api.getOutputCollectionState();
    const errors = [];

    for (const validator of [...this._commonCollectionValidators, ...this._blockInstance.cfg.collectionValidators]) {
      try {
        const error = validator(collection, this._blockInstance.api);
        if (!error) {
          continue;
        }
        if (error) {
          errors.push(this._addCustomTypeToValidationError(error));

          if (!error.message) {
            console.warn(LOG_TEXT.MISSING_ERROR_MESSAGE);
          }
        }
      } catch (error) {
        console.warn(LOG_TEXT.COLLECTION_VALIDATION_FAILED, error);
      }
    }

    this._blockInstance.$['*collectionErrors'] = errors;

    if (errors.length > 0) {
      this._blockInstance.emit(
        EventType.COMMON_UPLOAD_FAILED,
        () =>
          /** @type {import('../../types').OutputCollectionState<'failed'>} */ (
            this._blockInstance.api.getOutputCollectionState()
          ),
        { debounce: true },
      );
    }
  }

  /** @param {import('../TypedData.js').TypedData<typeof import('../uploadEntrySchema.js').uploadEntrySchema>} entry */
  cleanupValidationForEntry(entry) {
    const state = this._entryValidationState.get(entry.uid);
    if (state) {
      state.abortController?.abort();
      this._entryValidationState.delete(entry.uid);
    }
  }

  /**
   * @private
   * @param {import('../TypedData.js').TypedData<typeof import('../uploadEntrySchema.js').uploadEntrySchema>} entry
   * @param {FileValidatorDescriptor['runOn']} runOn
   */
  async _runFileValidatorsForEntry(entry, runOn) {
    const entryDescriptors = this._getValidatorDescriptorsForEntry(entry, runOn);
    if (entryDescriptors.length === 0) {
      return;
    }
    entry.setMultipleValues({
      isQueuedForValidation: true,
      isValidationPending: true,
    });
    const outputEntry = this._blockInstance.api.getOutputItem(entry.uid);
    const state = this._getEntryValidationState(entry);

    if (state.promise) {
      await state.promise;
    }

    const { promise, resolve } = withResolvers();
    state.promise = promise;
    const abortController = new AbortController();
    state.abortController = abortController;

    const timeoutMs = this._blockInstance.cfg.validationTimeout;
    const allDescriptors = this._getValidatorDescriptors();

    /** @type {import('../../types').OutputErrorFile[]} */
    const errors = allDescriptors
      .filter((descriptor) => !entryDescriptors.some((d) => descriptor.validator === d.validator))
      .map((descriptor) => state.lastErrorThrownByValidator.get(descriptor.validator))
      .filter(Boolean);

    const tasks = entryDescriptors.map((validatorDescriptor) => async () => {
      const timeoutId = setTimeout(() => {
        state.skippedValidators.add(validatorDescriptor.validator);
        abortController.abort();
        console.warn(LOG_TEXT.FILE_VALIDATION_TIMEOUT);
      }, timeoutMs);

      try {
        const error = await validatorDescriptor.validator(outputEntry, this._blockInstance.api, {
          signal: abortController.signal,
        });
        if (!error || abortController.signal.aborted) {
          state.lastErrorThrownByValidator.set(validatorDescriptor.validator, undefined);
          return;
        }
        const normalizedError = this._addCustomTypeToValidationError(error);
        state.lastErrorThrownByValidator.set(validatorDescriptor.validator, normalizedError);
        errors.push(normalizedError);

        if (!error.message) {
          console.warn(LOG_TEXT.MISSING_ERROR_MESSAGE);
        }
      } catch (error) {
        if (!abortController.signal.aborted) {
          state.skippedValidators.add(validatorDescriptor.validator);

          console.warn(LOG_TEXT.FILE_VALIDATION_FAILED, error);
          this._blockInstance.telemetryManager.sendEventError(
            error,
            `file validator. ${LOG_TEXT.FILE_VALIDATION_FAILED}`,
          );
        }
      } finally {
        clearTimeout(timeoutId);
        if (validatorDescriptor.runOn !== 'change') {
          state.skippedValidators.add(validatorDescriptor.validator);
        }
      }
    });

    this._runQueueDebounced();

    await this._queue.add(
      async () => {
        entry.setValue('isQueuedForValidation', false);
        await Promise.all(tasks.map((task) => task())).catch(() => {});
      },
      {
        autoRun: false,
      },
    );

    if (abortController.signal.aborted) {
      entry.setMultipleValues({
        isQueuedForValidation: false,
        isValidationPending: false,
      });
      resolve();
      return;
    }

    entry.setMultipleValues({
      isValidationPending: false,
      isQueuedForValidation: false,
      errors,
    });

    resolve();
  }

  /**
   * @private
   * @template {import('../../types').OutputError<
   *   import('../../types').OutputFileErrorType | import('../../types').OutputCollectionErrorType
   * >} T
   * @param {T} error
   * @returns {T}
   */
  _addCustomTypeToValidationError(error) {
    return {
      ...error,
      type: error.type ?? 'CUSTOM_ERROR',
    };
  }

  /**
   * @private
   * @param {import('../TypedData.js').TypedData<typeof import('../uploadEntrySchema.js').uploadEntrySchema>} entry
   */
  _getEntryValidationState(entry) {
    const currentState = this._entryValidationState.get(entry.uid);
    if (currentState) {
      return currentState;
    }

    const newState = {
      abortController: undefined,
      skippedValidators: new WeakSet(),
      promise: undefined,
      lastErrorThrownByValidator: /** @type {WeakMap<FuncFileValidator, import('../../types').OutputErrorFile>} */ (
        new WeakMap()
      ),
    };
    this._entryValidationState.set(entry.uid, newState);
    return newState;
  }

  /** @private */
  _getValidatorDescriptors() {
    return [...this._commonFileValidators, ...this._blockInstance.cfg.fileValidators].map(getValidatorDescriptor);
  }

  /**
   * @private
   * @param {import('../TypedData.js').TypedData<typeof import('../uploadEntrySchema.js').uploadEntrySchema>} entry
   * @param {FileValidatorDescriptor['runOn']} runOn
   */
  _getValidatorDescriptorsForEntry(entry, runOn) {
    const state = this._getEntryValidationState(entry);
    return this._getValidatorDescriptors()
      .filter((descriptor) => !state.skippedValidators.has(descriptor.validator))
      .filter((descriptor) => descriptor.runOn === runOn);
  }
}
