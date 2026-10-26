import { Queue } from '@uploadcare/upload-client';
import { EventEmitter, EventType } from '../../blocks/UploadCtxProvider/EventEmitter';
import type {
  OutputCollectionErrorType,
  OutputCollectionState,
  OutputError,
  OutputErrorCollection,
  OutputErrorFile,
  OutputFileErrorType,
} from '../../types';
import { debounce } from '../../utils/debounce';
import {
  validateCollectionUploadError,
  validateGroupError,
  validateMultiple,
} from '../../utils/validators/collection/index';
import {
  validateFileType,
  validateIsImage,
  validateMaxSizeLimit,
  validateUploadError,
} from '../../utils/validators/file/index';
import { withResolvers } from '../../utils/withResolvers';
import { controllerLogger } from '../controllerLogger';
import { lifetimeOf } from '../di/ControllerContainer';
import { Disposables } from '../di/Disposables';
import { inject } from '../di/inject';
import { TelemetryManager } from '../managers/TelemetryManager';
import type { TypedData } from '../TypedData';
import type { Uid } from '../Uid';
import { UploaderPublicApi } from '../UploaderPublicApi';
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
  // Never run again for this entry: an `add`/`upload` validator once it has run, and any validator that timed out
  // or threw.
  retiredValidators: WeakSet<FuncFileValidator>;
  promise?: Promise<void>;
  lastErrorThrownByValidator: WeakMap<FuncFileValidator, OutputErrorFile | undefined>;
  // The entry's first `add` and `change` runs (both start from its add): `firstPass` settles once both have.
  firstRuns: Set<FileValidatorDescriptor['runOn']>;
  firstPass: ReturnType<typeof withResolvers<void>>;
};

/**
 * DOM-free validation engine — a faithful port of v1's `ValidationManager`.
 *
 * Same built-in validators, same async queue with per-entry abort/timeout and
 * `runOn` (`add`/`upload`/`change`) semantics, same error-dedup behavior.
 * Container-resolved (M-god step 5): controller peers (config, collection, and
 * `CollectionStateController` — the collection-errors sink), the public API, the
 * per-ctx `EventEmitter` (for the debounced `common-upload-failed`) and
 * `TelemetryManager` (the never-throwing validator-error sink) are `@inject`-ed,
 * so it runs zero-arg without a DOM and is unit testable in isolation. Entries
 * remain `TypedData`.
 */
export class ValidationController {
  // Per-ctx logger: `warn`/`error` always print, prefixed with THIS ctx's name
  // (resolved lazily at log time via the container that built this instance).
  private readonly _log = controllerLogger(this, 'validation');
  @inject(ConfigController) private readonly _config!: ConfigController;
  @inject(UploadCollectionController) private readonly _collection!: UploadCollectionController;
  @inject(CollectionStateController) private readonly _collectionState!: CollectionStateController;
  // Thunk: `UploaderPublicApi` reaches this class back through `UploadController`, so a direct token is still
  // uninitialized when the decorator runs.
  @inject(() => UploaderPublicApi) private readonly _api!: UploaderPublicApi;
  @inject(TelemetryManager) private readonly _telemetry!: TelemetryManager;
  @inject(EventEmitter) private readonly _eventEmitter!: EventEmitter;

  private _commonFileValidators: FuncFileValidator[] = [
    validateIsImage,
    validateFileType,
    validateMaxSizeLimit,
    validateUploadError,
  ];

  private _commonCollectionValidators: FuncCollectionValidator[] = [
    validateMultiple,
    validateCollectionUploadError,
    validateGroupError,
  ];

  private _queue = new Queue(20);
  private _runQueueDebounced = debounce(() => {
    this._queue.run();
  }, 500);

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
    const lifetime = lifetimeOf(this);
    if (lifetime.signal.aborted) return;

    const ids = entryIds ?? this._collection.items();
    for (const id of ids) {
      const entry = this._collection.read(id);
      if (entry) {
        lifetime.run(
          () => this._runFileValidatorsForEntry(entry, runOn),
          (error) => this._log.error('File validation failed', error),
        );
      }
    }
  }

  public runCollectionValidators(): void {
    // Collection validators are user callbacks: none runs once the ctx is torn down.
    if (lifetimeOf(this).signal.aborted) return;

    const api = this._api;
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
      // Inlined from the removed bridge's `emitCommonUploadFailed`: the debounced
      // `common-upload-failed` with a thunked failed-collection-state payload.
      this._eventEmitter.emit(
        EventType.COMMON_UPLOAD_FAILED,
        () => this._api.getOutputCollectionState() as OutputCollectionState<'failed'>,
        { debounce: true },
      );
    }
  }

  public cleanupValidationForEntry(entry: TypedData<UploadEntryData>): void {
    const state = this._entryValidationState.get(entry.uid);
    if (state) {
      state.abortController?.abort();
      state.firstPass.resolve();
      this._entryValidationState.delete(entry.uid);
    }
  }

  /**
   * Settles once the entry has been through its first `add` and `change` validator runs, and through any run queued
   * after them. An upload waits on this, so a file added in the same tick is validated before anything is sent.
   */
  public async whenValidated(entry: TypedData<UploadEntryData>): Promise<void> {
    const state = this._getEntryValidationState(entry);
    await state.firstPass.promise;
    while (state.promise) {
      await state.promise;
    }
  }

  private async _runFileValidatorsForEntry(
    entry: TypedData<UploadEntryData>,
    runOn: FileValidatorDescriptor['runOn'],
  ): Promise<void> {
    // The only caller (`runFileValidators`) already checks the lifetime, and
    // there is no async boundary between there and here, so no re-check is
    // needed until after the first `await` below.
    const lifetime = lifetimeOf(this);
    const api = this._api;
    const state = this._getEntryValidationState(entry);

    const previousPromise = state.promise ?? Promise.resolve();
    const runPromise = (async () => {
      await previousPromise;
      if (lifetime.signal.aborted) return;
      const entryDescriptors = this._getValidatorDescriptorsForEntry(entry, runOn);
      if (entryDescriptors.length === 0 || !this._collection.hasItem(entry.uid)) {
        return;
      }
      entry.setMany({
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
        // Its own signal, so a timeout ignores only this validator's result; removing the entry still aborts it.
        const validatorAbort = new AbortController();
        const abortValidator = () => validatorAbort.abort();
        abortController.signal.addEventListener('abort', abortValidator, { once: true });
        // Stop waiting once aborted: a validator that ignores its signal must not hold the entry pending.
        const aborted = new Promise<undefined>((resolve) => {
          validatorAbort.signal.addEventListener('abort', () => resolve(undefined), { once: true });
        });
        const timeoutId = setTimeout(() => {
          state.retiredValidators.add(validatorDescriptor.validator);
          validatorAbort.abort();
          this._log.warn(LOG_TEXT.FILE_VALIDATION_TIMEOUT);
        }, timeoutMs);

        try {
          const error = await Promise.race([
            validatorDescriptor.validator(outputEntry, api, { signal: validatorAbort.signal }),
            aborted,
          ]);
          if (!error || validatorAbort.signal.aborted) {
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
          if (!validatorAbort.signal.aborted) {
            state.retiredValidators.add(validatorDescriptor.validator);
            this._log.warn(LOG_TEXT.FILE_VALIDATION_FAILED, error);
            this._telemetry.sendEventError(error, `file validator. ${LOG_TEXT.FILE_VALIDATION_FAILED}`);
          }
        } finally {
          clearTimeout(timeoutId);
          abortController.signal.removeEventListener('abort', abortValidator);
          if (validatorDescriptor.runOn !== 'change') {
            state.retiredValidators.add(validatorDescriptor.validator);
          }
        }
      });

      this._runQueueDebounced();

      await this._queue.add(
        async () => {
          // `destroy()` cancels `_runQueueDebounced`, but a queue already running drains into this task: the
          // validators are user callbacks, so none is invoked once the ctx is torn down.
          if (lifetime.signal.aborted) return;
          entry.set('isQueuedForValidation', false);
          // Every task catches its validator's failure; a rejection here means the failure handling itself threw.
          // Wait for all of them, so no late error lands after this run has written its results, and log it.
          for (const result of await Promise.allSettled(tasks.map((task) => task()))) {
            if (result.status === 'rejected') this._log.warn(LOG_TEXT.FILE_VALIDATION_FAILED, result.reason);
          }
        },
        {
          autoRun: false,
        },
      );

      if (abortController.signal.aborted) {
        entry.setMany({
          isQueuedForValidation: false,
          isValidationPending: false,
        });
        return;
      }

      entry.setMany({
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
      if (runOn !== 'upload') {
        state.firstRuns.add(runOn);
        if (state.firstRuns.size === 2) {
          state.firstPass.resolve();
        }
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
      retiredValidators: new WeakSet<FuncFileValidator>(),
      promise: undefined,
      lastErrorThrownByValidator: new WeakMap<FuncFileValidator, OutputErrorFile | undefined>(),
      firstRuns: new Set(),
      firstPass: withResolvers<void>(),
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
      .filter((descriptor) => !state.retiredValidators.has(descriptor.validator))
      .filter((descriptor) => descriptor.runOn === runOn);
  }

  public destroy(): void {
    // Runs the config-subscription teardown + the two debounce cancels.
    this.#disposables.run();

    for (const state of this._entryValidationState.values()) {
      state.abortController?.abort();
      state.firstPass.resolve();
      state.promise = undefined;
    }
    this._entryValidationState.clear();
  }
}
