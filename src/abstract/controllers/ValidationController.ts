import { Queue } from '@uploadcare/upload-client';
import type { Uid } from '../../lit/Uid';
import type {
  OutputCollectionErrorType,
  OutputError,
  OutputErrorCollection,
  OutputErrorFile,
  OutputFileErrorType,
} from '../../types';
import { debounce } from '../../utils/debounce';
import { validateCollectionUploadError, validateMultiple } from '../../utils/validators/collection/index';
import {
  validateFileType,
  validateIsImage,
  validateMaxSizeLimit,
  validateUploadError,
} from '../../utils/validators/file/index';
import { containerOf } from '../di/ControllerContainer';
import { Disposables } from '../di/Disposables';
import { inject } from '../di/inject';
import { logger } from '../logger';
import type { TypedData } from '../TypedData';
import type { UploadEntryData } from '../uploadEntrySchema';
import type {
  FileValidator,
  FileValidatorDescriptor,
  FuncCollectionValidator,
  FuncFileValidator,
} from '../validatorTypes';
import { CollectionStateController } from './CollectionStateController';
import { ConfigController } from './ConfigController';
import { UploadCollectionController } from './UploadCollectionController';
import { UploadHostBridge } from './UploadHostBridge';

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

/** Config keys whose change re-runs all validators (v1 parity). */
const RERUN_CONFIG_KEYS = [
  'maxLocalFileSizeBytes',
  'multipleMin',
  'multipleMax',
  'multiple',
  'imgOnly',
  'accept',
] as const;

type EntryValidationState = {
  abortController?: AbortController;
  skippedValidators: WeakSet<FuncFileValidator>;
  promise?: Promise<void>;
  lastErrorThrownByValidator: WeakMap<FuncFileValidator, OutputErrorFile | undefined>;
};

/**
 * DOM-free validation engine — a faithful port of v1's `ValidationManager`.
 *
 * Same built-in validators, same async queue with per-entry abort/timeout and
 * `runOn` (`add`/`upload`/`change`) semantics, same error-dedup behavior.
 * Container-resolved (M-god step 5): controller peers (config, collection, and
 * `CollectionStateController` — the collection-errors sink) and the
 * `UploadHostBridge` (public api, `emitCommonUploadFailed`, telemetry sink) are
 * `@inject`-ed, so it runs zero-arg without a DOM and is unit testable in
 * isolation. Entries remain `TypedData`.
 */
export class ValidationController {
  // Per-ctx logger: `warn`/`error` always print, prefixed with THIS ctx's name
  // (resolved lazily at log time via the container that built this instance).
  private readonly _log = logger.scope('validation', { ctxName: () => containerOf(this)?.ctxName });
  @inject(ConfigController) private readonly _config!: ConfigController;
  @inject(UploadCollectionController) private readonly _collection!: UploadCollectionController;
  @inject(CollectionStateController) private readonly _collectionState!: CollectionStateController;
  @inject(UploadHostBridge) private readonly _host!: UploadHostBridge;

  private _commonFileValidators: FuncFileValidator[] = [
    validateIsImage,
    validateFileType,
    validateMaxSizeLimit,
    validateUploadError,
  ];

  private _commonCollectionValidators: FuncCollectionValidator[] = [validateMultiple, validateCollectionUploadError];

  private _queue = new Queue(20);
  private _runQueueDebounced = debounce(() => {
    this._queue.run();
  }, 500);

  private _isDestroyed = false;
  private _entryValidationState = new Map<string, EntryValidationState>();
  readonly #disposables = new Disposables();
  private _lastRerunSnapshot = '';

  private _runAllValidators = debounce(() => {
    this.runFileValidators('change');
    this.runCollectionValidators();
  }, 0);

  /**
   * Container lifecycle hook — runs after the container has tagged + cached this
   * instance, so `@inject` fields resolve (they must NOT be read in the zero-arg
   * constructor, which runs before the container tags the instance). Seeds the
   * queue concurrency + rerun snapshot, subscribes to config, and kicks off the
   * initial validation pass, exactly as v1's construction-time wiring did.
   */
  public init(): void {
    this._queue.concurrency = this._concurrencyFromConfig();
    this._lastRerunSnapshot = this._rerunSnapshot();
    this.#disposables.add(
      this._config.subscribe(() => {
        this._queue.concurrency = this._concurrencyFromConfig();
        const next = this._rerunSnapshot();
        if (next !== this._lastRerunSnapshot) {
          this._lastRerunSnapshot = next;
          this._runAllValidators();
        }
      }),
    );
    this.#disposables.add(() => this._runAllValidators.cancel());
    this.#disposables.add(() => this._runQueueDebounced.cancel());
    // v1 parity: the config subscriptions fired immediately, kicking off one
    // initial validation pass.
    this._runAllValidators();
  }

  private _concurrencyFromConfig(): number {
    const value = Number(this._config.get('validationConcurrency'));
    return value > 0 ? value : 20;
  }

  private _rerunSnapshot(): string {
    // NUL delimiter (via the `\x00` escape — clean ASCII source, unlike the
    // literal NUL byte that historically corrupted this file into a binary
    // blob): config string values can contain spaces, so a space delimiter
    // risks snapshot collisions; NUL cannot appear in a config value.
    return RERUN_CONFIG_KEYS.map((key) => String(this._config.get(key))).join('\x00');
  }

  public runFileValidators(runOn: FileValidatorDescriptor['runOn'], entryIds?: Uid[]): void {
    if (this._isDestroyed) return;

    const ids = entryIds ?? this._collection.items();
    for (const id of ids) {
      const entry = this._collection.read(id);
      if (entry) {
        void this._runFileValidatorsForEntry(entry, runOn);
      }
    }
  }

  public runCollectionValidators(): void {
    if (this._isDestroyed) return;

    const api = this._host.getApi();
    const collection = api.getOutputCollectionState();
    const errors: Array<OutputErrorCollection> = [];
    const collectionValidators = this._config.get('collectionValidators');

    for (const validator of [...this._commonCollectionValidators, ...collectionValidators]) {
      try {
        const error = validator(collection, api);
        if (!error) {
          continue;
        }
        errors.push(this._addCustomTypeToValidationError(error));
        if (!error.message) {
          this._log.warn(LOG_TEXT.MISSING_ERROR_MESSAGE);
        }
      } catch (error) {
        this._log.warn(LOG_TEXT.COLLECTION_VALIDATION_FAILED, error);
      }
    }

    this._collectionState.set('collectionErrors', errors);

    if (errors.length > 0) {
      this._host.emitCommonUploadFailed();
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
    // The only caller (`runFileValidators`) already guards `_isDestroyed`, and
    // there is no async boundary between there and here, so no re-check is
    // needed until after the first `await` below.
    const api = this._host.getApi();
    const state = this._getEntryValidationState(entry);

    const previousPromise = state.promise ?? Promise.resolve();
    const runPromise = (async () => {
      await previousPromise;
      if (this._isDestroyed) return;
      const entryDescriptors = this._getValidatorDescriptorsForEntry(entry, runOn);
      if (entryDescriptors.length === 0 || !this._collection.hasItem(entry.uid)) {
        return;
      }
      entry.setMultipleValues({
        isQueuedForValidation: true,
        isValidationPending: true,
      });
      const outputEntry = api.getOutputItem(entry.uid);

      const abortController = new AbortController();
      state.abortController = abortController;

      const timeoutMs = this._config.get('validationTimeout');
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
          this._log.warn(LOG_TEXT.FILE_VALIDATION_TIMEOUT);
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
            this._log.warn(LOG_TEXT.MISSING_ERROR_MESSAGE);
          }
        } catch (error) {
          if (!abortController.signal.aborted) {
            state.skippedValidators.add(validatorDescriptor.validator);
            this._log.warn(LOG_TEXT.FILE_VALIDATION_FAILED, error);
            this._host.onValidatorError(error, `file validator. ${LOG_TEXT.FILE_VALIDATION_FAILED}`);
          }
        } finally {
          clearTimeout(timeoutId);
          if (validatorDescriptor.runOn !== 'change') {
            state.skippedValidators.add(validatorDescriptor.validator);
          }
        }
      });

      this._runQueueDebounced();

      // `destroy()` cancels `_runQueueDebounced`, so this queued task never
      // runs after teardown — no in-task `_isDestroyed` guard is reachable.
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
    // `OutputError` is a conditional type whose `type` is optional only for
    // the custom-error branch, so read it through a narrow shape. User
    // validators may omit `type`; default it to `CUSTOM_ERROR`.
    const type = (error as { type?: string }).type ?? 'CUSTOM_ERROR';
    return { ...error, type } as T;
  }

  private _getEntryValidationState(entry: TypedData<UploadEntryData>): EntryValidationState {
    const currentState = this._entryValidationState.get(entry.uid);
    if (currentState) {
      return currentState;
    }

    const newState: EntryValidationState = {
      abortController: undefined,
      skippedValidators: new WeakSet<FuncFileValidator>(),
      promise: undefined,
      lastErrorThrownByValidator: new WeakMap<FuncFileValidator, OutputErrorFile | undefined>(),
    };
    this._entryValidationState.set(entry.uid, newState);
    return newState;
  }

  private _getValidatorDescriptors(): FileValidatorDescriptor[] {
    const fileValidators = this._config.get('fileValidators');
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

  public destroy(): void {
    this._isDestroyed = true;
    // Runs the config-subscription teardown + the two debounce cancels.
    this.#disposables.run();

    for (const state of this._entryValidationState.values()) {
      state.abortController?.abort();
      state.promise = undefined;
    }
    this._entryValidationState.clear();
  }
}
