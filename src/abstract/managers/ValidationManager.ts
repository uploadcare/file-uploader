import { Queue } from '@uploadcare/upload-client';
import { EventType } from '../../blocks/UploadCtxProvider/EventEmitter';
import { SharedInstance, type SharedInstancesBag } from '../../lit/shared-instances';
import type { Uid } from '../../lit/Uid';
import type {
  OutputCollectionErrorType,
  OutputCollectionState,
  OutputCollectionStatus,
  OutputError,
  OutputErrorCollection,
  OutputErrorFile,
  OutputFileEntry,
  OutputFileErrorType,
  UploaderPublicApi,
} from '../../types';
import { debounce } from '../../utils/debounce';
import { validateCollectionUploadError, validateMultiple } from '../../utils/validators/collection/index';
import {
  validateFileType,
  validateIsImage,
  validateMaxSizeLimit,
  validateUploadError,
} from '../../utils/validators/file/index';
import type { buildOutputCollectionState } from '../buildOutputCollectionState';
import { sharedConfigKey } from '../sharedConfigKey';
import type { TypedCollection } from '../TypedCollection';
import type { TypedData } from '../TypedData';
import type { UploadEntryData } from '../uploadEntrySchema';

export type FuncFileValidator = (
  outputEntry: OutputFileEntry,
  api: UploaderPublicApi,
  options?: { signal?: AbortSignal },
) => undefined | OutputErrorFile | Promise<undefined | OutputErrorFile>;

export type FileValidatorDescriptor = {
  runOn: 'add' | 'upload' | 'change';
  validator: FuncFileValidator;
};

export type FileValidator = FileValidatorDescriptor | FuncFileValidator;

export type FuncCollectionValidator = (
  collection: ReturnType<typeof buildOutputCollectionState<OutputCollectionStatus>>,
  api: UploaderPublicApi,
) => undefined | OutputErrorCollection;

const LOG_TEXT = {
  FILE_VALIDATION_FAILED: 'File validator execution has failed',
  FILE_VALIDATION_TIMEOUT: 'File validator execution has timed out',
  COLLECTION_VALIDATION_FAILED: 'Collection validator execution has failed',
  MISSING_ERROR_MESSAGE: 'Missing message. We recommend adding message: value.',
};

const getValidatorDescriptor = (validator: FileValidator): FileValidatorDescriptor => {
  if (typeof validator === 'function') {
    return { runOn: 'change', validator };
  }
  return validator;
};

export class ValidationManager extends SharedInstance {
  private _uploadCollection: TypedCollection<UploadEntryData>;

  private _commonFileValidators: FuncFileValidator[] = [
    validateIsImage,
    validateFileType,
    validateMaxSizeLimit,
    validateUploadError,
  ];

  private _commonCollectionValidators: FuncCollectionValidator[] = [validateMultiple, validateCollectionUploadError];

  private _queue = new Queue(20);
  private _runQueueDebounced: () => void = debounce(() => {
    this._queue.run();
  }, 500);

  private _entryValidationState: Map<
    string,
    {
      abortController?: AbortController;
      skippedValidators: WeakSet<FuncFileValidator>;
      promise?: Promise<void>;
      lastErrorThrownByValidator: WeakMap<FuncFileValidator, OutputErrorFile | undefined>;
    }
  > = new Map();

  public constructor(sharedInstancesBag: SharedInstancesBag) {
    super(sharedInstancesBag);

    this._uploadCollection = sharedInstancesBag.uploadCollection;

    const runAllValidators = debounce(() => {
      this.runFileValidators('change');
      this.runCollectionValidators();
    }, 0);

    this.addSub(this._ctx.sub(sharedConfigKey('maxLocalFileSizeBytes'), runAllValidators));
    this.addSub(this._ctx.sub(sharedConfigKey('multipleMin'), runAllValidators));
    this.addSub(this._ctx.sub(sharedConfigKey('multipleMax'), runAllValidators));
    this.addSub(this._ctx.sub(sharedConfigKey('multiple'), runAllValidators));
    this.addSub(this._ctx.sub(sharedConfigKey('imgOnly'), runAllValidators));
    this.addSub(this._ctx.sub(sharedConfigKey('accept'), runAllValidators));
    this.addSub(
      this._ctx.sub(sharedConfigKey('validationConcurrency'), (concurrency) => {
        this._queue.concurrency = concurrency;
      }),
    );
  }

  public runFileValidators(runOn: FileValidatorDescriptor['runOn'], entryIds?: Uid[]): void {
    const ids = entryIds ?? this._uploadCollection.items();
    for (const id of ids) {
      const entry = this._uploadCollection.read(id);
      if (entry) {
        void this._runFileValidatorsForEntry(entry, runOn);
      }
    }
  }

  public runCollectionValidators(): void {
    const api = this._sharedInstancesBag.api;
    const collection = api.getOutputCollectionState();
    const errors: Array<OutputErrorCollection> = [];
    const collectionValidators = this._cfg.collectionValidators;

    for (const validator of [...this._commonCollectionValidators, ...collectionValidators]) {
      try {
        const error = validator(collection, api);
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

    this._ctx.pub('*collectionErrors', errors);

    if (errors.length > 0) {
      this._sharedInstancesBag.eventEmitter.emit(
        EventType.COMMON_UPLOAD_FAILED,
        () => api.getOutputCollectionState() as OutputCollectionState<'failed'>,
        { debounce: true },
      );
    }
  }

  public cleanupValidationForEntry(entry: TypedData<UploadEntryData>): void {
    const state = this._entryValidationState.get(entry.uid);
    if (state) {
      state.abortController?.abort();
      this._entryValidationState.delete(entry.uid);
    }
  }

  private async _runFileValidatorsForEntry(
    entry: TypedData<UploadEntryData>,
    runOn: FileValidatorDescriptor['runOn'],
  ): Promise<void> {
    const api = this._sharedInstancesBag.api;
    const state = this._getEntryValidationState(entry);

    const previousPromise = state.promise ?? Promise.resolve();
    const runPromise = (async () => {
      await previousPromise;
      const entryDescriptors = this._getValidatorDescriptorsForEntry(entry, runOn);
      if (entryDescriptors.length === 0 || !this._uploadCollection.hasItem(entry.uid)) {
        return;
      }
      entry.setMultipleValues({
        isQueuedForValidation: true,
        isValidationPending: true,
      });
      const outputEntry = api.getOutputItem(entry.uid);

      const abortController = new AbortController();
      state.abortController = abortController;

      const timeoutMs = this._ctx.read(sharedConfigKey('validationTimeout'));
      const allDescriptors = this._getValidatorDescriptors();

      const entryValidatorSet = new Set(entryDescriptors.map((d) => d.validator));
      const errors: OutputErrorFile[] = [];
      for (const descriptor of allDescriptors) {
        if (!entryValidatorSet.has(descriptor.validator)) {
          const error = state.lastErrorThrownByValidator.get(descriptor.validator);
          if (error) errors.push(error);
        }
      }

      const tasks = entryDescriptors.map((validatorDescriptor) => async () => {
        const timeoutId = setTimeout(() => {
          state.skippedValidators.add(validatorDescriptor.validator);
          abortController.abort();
          console.warn(LOG_TEXT.FILE_VALIDATION_TIMEOUT);
        }, timeoutMs);

        try {
          const error = await validatorDescriptor.validator(outputEntry, api, {
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
            this._sharedInstancesBag.telemetryManager.sendEventError(
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
        return;
      }

      entry.setMultipleValues({
        isValidationPending: false,
        isQueuedForValidation: false,
        errors,
      });
    })();

    state.promise = runPromise;

    try {
      await runPromise;
    } finally {
      if (state.promise === runPromise) {
        state.promise = undefined;
      }
    }
  }

  private _addCustomTypeToValidationError<T extends OutputError<OutputFileErrorType | OutputCollectionErrorType>>(
    error: T,
  ): T {
    return {
      ...(error as any),
      type: (error as any).type ?? 'CUSTOM_ERROR',
    } as T;
  }
  private _getEntryValidationState(entry: TypedData<UploadEntryData>): {
    abortController?: AbortController;
    skippedValidators: WeakSet<FuncFileValidator>;
    promise?: Promise<void>;
    lastErrorThrownByValidator: WeakMap<FuncFileValidator, OutputErrorFile | undefined>;
  } {
    const currentState = this._entryValidationState.get(entry.uid);
    if (currentState) {
      return currentState;
    }

    const newState = {
      abortController: undefined,
      skippedValidators: new WeakSet<FuncFileValidator>(),
      promise: undefined,
      lastErrorThrownByValidator: new WeakMap<FuncFileValidator, OutputErrorFile | undefined>(),
    };
    this._entryValidationState.set(entry.uid, newState);
    return newState;
  }
  private _getValidatorDescriptors(): FileValidatorDescriptor[] {
    const fileValidators = this._ctx.read(sharedConfigKey('fileValidators'));
    return [...this._commonFileValidators, ...fileValidators].map(getValidatorDescriptor);
  }
  private _getValidatorDescriptorsForEntry(
    entry: TypedData<UploadEntryData>,
    runOn: FileValidatorDescriptor['runOn'],
  ): FileValidatorDescriptor[] {
    const state = this._getEntryValidationState(entry);
    return this._getValidatorDescriptors()
      .filter((descriptor) => !state.skippedValidators.has(descriptor.validator))
      .filter((descriptor) => descriptor.runOn === runOn);
  }
}
