import { Queue } from '@uploadcare/upload-client';
import type {
  CollectionValidators,
  FileValidators,
  OutputErrorCollection,
  OutputErrorFile,
  OutputFileEntry,
} from '../../types/exported';
import { IMAGE_ACCEPT_LIST, matchExtension, matchMimeType, mergeFileTypes } from '../../utils/fileTypes';
import { prettyBytes } from '../../utils/prettyBytes';
import { Listeners } from '../host-subscription';
import { getOutputItem } from '../output-collection-state';
import type { UploadCollection } from '../UploadCollection';
import type { UploadEntry } from '../UploadEntry';
import type { ConfigController } from './ConfigController';
import type { LocaleController } from './LocaleController';

/**
 * v2-internal shape passed to validators. Mirrors the entry's stored
 * fields (which may be null pre-upload), distinct from the
 * public-facing `OutputFileEntry` whose fields are populated post-upload.
 */
export interface ValidationItem {
  internalId: string;
  name: string | null;
  size: number | null;
  file: File | null;
  externalUrl: string | null;
  uuid: string | null;
  cdnUrl: string | null;
  cdnUrlModifiers: string | null;
  mimeType: string | null;
  isImage: boolean;
  status: 'idle' | 'uploading' | 'success' | 'failed' | 'removed';
  uploadProgress: number;
  errors: string[];
  source: string | null;
}

/**
 * Sync internal-shape validator used by built-ins and plugins. Receives
 * `ValidationItem` (pre-upload-aware) and returns synchronously.
 */
export type FileValidator = (item: ValidationItem, cfg: Readonly<unknown>) => OutputErrorFile | undefined;

export type CollectionValidator = (
  items: readonly ValidationItem[],
  cfg: Readonly<unknown>,
) => OutputErrorCollection | undefined;

type CfgShape = {
  multiple?: boolean;
  multipleMin?: number;
  multipleMax?: number;
  imgOnly?: boolean;
  accept?: string;
  maxLocalFileSizeBytes?: number;
  fileValidators?: FileValidators;
  collectionValidators?: CollectionValidators;
  validationConcurrency?: number;
  validationTimeout?: number;
};

const DEFAULT_VALIDATION_TIMEOUT_MS = 60_000;
const DEFAULT_VALIDATION_CONCURRENCY = 100;

/**
 * Normalise both signatures (bare function or `{ validator, runOn }`
 * descriptor) the user may register under `config.fileValidators`.
 * The result accepts the v1-shaped `OutputFileEntry`.
 */
type UserValidatorFn = (
  outputEntry: OutputFileEntry,
  cfg: unknown,
) => OutputErrorFile | undefined | Promise<OutputErrorFile | undefined>;

type ValidatorRunOn = 'add' | 'upload' | 'change';

function unwrapUserValidator(v: NonNullable<FileValidators>[number]): UserValidatorFn {
  return typeof v === 'function' ? (v as UserValidatorFn) : (v.validator as UserValidatorFn);
}

function validatorRunOn(v: NonNullable<FileValidators>[number]): ValidatorRunOn {
  if (typeof v === 'function') return 'change';
  return ((v as { runOn?: ValidatorRunOn }).runOn ?? 'change') as ValidatorRunOn;
}

/** Per-entry tracking for `runOn: 'add'` / `runOn: 'upload'` semantics. */
type ValidatorRunRecord = {
  addRanFor: WeakSet<object>;
  uploadRanFor: WeakSet<object>;
};

/**
 * v2-native validation engine.
 *
 * Holds the current collection errors as reactive state and writes
 * per-entry validation errors back into each entry's `errors` field.
 * Built-ins enforce `multipleMin/Max`, `maxLocalFileSizeBytes`,
 * `accept`, and `imgOnly` — the same rules as v1's `ValidationManager`.
 *
 * Wired from `UploaderController` after the collection exists; the
 * controller subscribes to config + collection structural changes and
 * re-runs validation each time. Per-entry field changes (file name /
 * mime / etc.) trigger a single-entry revalidation.
 */
export class ValidationController {
  private _fileValidators: FileValidator[] = [];
  private _collectionValidators: CollectionValidator[] = [];
  private _listeners = new Listeners();

  private _collection: UploadCollection | null = null;
  private _collectionErrors: OutputErrorCollection[] = [];
  private _entrySubs = new Map<string, Array<() => void>>();
  private _unsubConfig?: () => void;
  private _unsubCollection?: () => void;
  /**
   * Lazy factory for the v1-shape `OutputCollectionState` passed as the
   * first argument to user-supplied collection validators. Wired by
   * `UploaderController` after both validation + api exist; built-ins
   * keep the cheaper `ValidationItem[]` signature.
   */
  private _userCollectionState: (() => unknown) | null = null;
  /** Lazy accessor for the public `UploaderApi`, passed as the v1
   * `api` argument to user-supplied file + collection validators. */
  private _userApi: (() => unknown) | null = null;
  // Re-entrancy guard: when we write `errors` to an entry it triggers a
  // re-validate via the field listener; ignore that nested call.
  private _writingErrors = false;
  /** Concurrency-limited queue for async user validators. */
  private _asyncQueue = new Queue(DEFAULT_VALIDATION_CONCURRENCY);
  /**
   * Per-entry abort controllers — cancel in-flight async validation
   * when the entry is removed. We track the full set per entry (not
   * just the latest) so that multiple chained runs sharing the entry
   * all get aborted on removal. Within a single run the controller is
   * used both as the `signal` argument to the user validator and as
   * the cancel signal for `raceWithTimeout`.
   */
  private _asyncAborts = new Map<string, Set<AbortController>>();
  /**
   * Per-entry promise chain that serializes async validator runs (v1
   * parity). A new run awaits the previous run so the in-flight
   * validator gets to write its result before the next one starts.
   * Without this, rapid changes (upload start, completion, etc.) would
   * cancel an in-flight 500ms validator before it could settle.
   */
  private _runPromises = new Map<string, Promise<void>>();
  /** Per-entry runOn tracking for `'add'` / `'upload'` validators. */
  private _runRecord = new Map<string, ValidatorRunRecord>();

  public constructor(
    private _config: ConfigController,
    private _locale: LocaleController,
  ) {
    this._fileValidators.push(
      this._builtinMaxSize,
      // `_builtinIsImage` runs before `_builtinFileType` so that when both
      // `imgOnly` and `accept` would fail, the user sees `NOT_AN_IMAGE`
      // (the more specific error) — v1 parity.
      this._builtinIsImage,
      this._builtinFileType,
    );
    this._collectionValidators.push(this._builtinMultiple);
    this._builtinCount = {
      file: this._fileValidators.length,
      collection: this._collectionValidators.length,
    };
  }

  private _builtinCount: { file: number; collection: number };

  // ─── Lifecycle ────────────────────────────────────────────────────────

  public start(collection: UploadCollection): void {
    if (this._collection) return;
    this._collection = collection;
    // Sync concurrency from config; default if unset.
    this._asyncQueue.concurrency = this._concurrencyFromConfig();

    this._unsubConfig = this._config.subscribe(() => {
      this._asyncQueue.concurrency = this._concurrencyFromConfig();
      this._revalidate();
    });
    this._unsubCollection = collection.subscribe((change) => {
      for (const entry of change.removed) this._unobserveEntry(entry);
      // Only validate the newly added entries — existing entries were
      // validated when they were added (or via per-key onChange below).
      // For 1000-file batches this turns O(N²) into O(N).
      for (const entry of change.added) {
        this._observeEntry(entry);
        this._validateEntry(entry);
      }
      this._refreshCollectionErrors();
    });
    for (const entry of collection.items) {
      this._observeEntry(entry);
      this._validateEntry(entry);
    }
    this._refreshCollectionErrors();
  }

  public destroy(): void {
    this._unsubConfig?.();
    this._unsubCollection?.();
    for (const unsubs of this._entrySubs.values()) {
      for (const u of unsubs) u();
    }
    this._entrySubs.clear();
    for (const aborts of this._asyncAborts.values()) {
      for (const ctrl of aborts) ctrl.abort();
    }
    this._asyncAborts.clear();
    this._runPromises.clear();
    this._runRecord.clear();
    this._fileValidators = [];
    this._collectionValidators = [];
    this._collectionErrors = [];
    this._listeners.clear();
  }

  private _concurrencyFromConfig(): number {
    const cfg = this._config.values as CfgShape;
    return Math.max(1, cfg.validationConcurrency ?? DEFAULT_VALIDATION_CONCURRENCY);
  }

  /** Returns the user-supplied validators registered under `config.fileValidators`. */
  private _userFileValidators(): NonNullable<FileValidators> {
    const cfg = this._config.values as unknown as CfgShape;
    return cfg.fileValidators ?? [];
  }

  // ─── Public surface ───────────────────────────────────────────────────

  public subscribe(listener: () => void): () => void {
    return this._listeners.subscribe(listener);
  }

  public get collectionErrors(): readonly OutputErrorCollection[] {
    return this._collectionErrors;
  }

  public addFileValidator(v: FileValidator): () => void {
    this._fileValidators.push(v);
    this._revalidate();
    return () => {
      this._fileValidators = this._fileValidators.filter((x) => x !== v);
      this._revalidate();
    };
  }

  public addCollectionValidator(v: CollectionValidator): () => void {
    this._collectionValidators.push(v);
    this._revalidate();
    return () => {
      this._collectionValidators = this._collectionValidators.filter((x) => x !== v);
      this._revalidate();
    };
  }

  /** One-shot pure run; doesn't mutate state. */
  public runForFile(item: ValidationItem): OutputErrorFile[] {
    const cfg = this._config.values as unknown as CfgShape;
    const errors: OutputErrorFile[] = [];
    for (const v of this._fileValidators) {
      const err = v(item, cfg);
      if (err) errors.push(err);
    }
    return errors;
  }

  public runForCollection(items: readonly ValidationItem[]): OutputErrorCollection[] {
    const cfg = this._config.values as unknown as CfgShape;
    const errors: OutputErrorCollection[] = [];
    // Built-ins (added at construction) — these expect `ValidationItem[]`.
    for (let i = 0; i < this._builtinCount.collection; i++) {
      const v = this._collectionValidators[i];
      if (!v) continue;
      const err = v(items, cfg);
      if (err) errors.push(err);
    }
    // Plugin-registered + user-supplied validators expect the v1-shape
    // `OutputCollectionState`. Build it lazily — the state object isn't
    // cheap to materialize.
    let userArg: unknown;
    const userValidators = [
      ...this._collectionValidators.slice(this._builtinCount.collection),
      ...((cfg.collectionValidators as readonly unknown[]) ?? []),
    ] as Array<(state: unknown, cfg: unknown) => OutputErrorCollection | undefined>;
    const apiArg = this._userApi?.();
    for (const v of userValidators) {
      if (typeof v !== 'function') continue;
      if (userArg === undefined) {
        userArg = this._userCollectionState?.() ?? items;
      }
      const err = (v as unknown as (state: unknown, api: unknown) => OutputErrorCollection | undefined)(
        userArg,
        apiArg ?? cfg,
      );
      if (!err) continue;
      errors.push({
        ...(err as OutputErrorCollection),
        type: (err as { type?: string }).type ?? 'CUSTOM_ERROR',
      } as OutputErrorCollection);
    }
    return errors;
  }

  /**
   * Inject the v1-shape state factory used as the first arg for user
   * collection validators. `UploaderController` wires this once at boot —
   * keeping the dependency one-way (validation depends only on a thunk,
   * not on the controller).
   */
  public setUserCollectionStateFactory(factory: () => unknown): void {
    this._userCollectionState = factory;
  }

  /** Inject the v1-shape `api` argument passed to user validators. */
  public setUserApiFactory(factory: () => unknown): void {
    this._userApi = factory;
  }

  // ─── Internals ────────────────────────────────────────────────────────

  private _observeEntry(entry: UploadEntry): void {
    if (this._entrySubs.has(entry.internalId)) return;
    // Coalesce per-entry change events: v1's PubSub flushed in a microtask
    // so a batched write to `cdnUrl` + `cdnUrlModifiers` produced one
    // validate pass; v2's UploadEntry notifies synchronously per field,
    // so we re-introduce the microtask boundary here. Without it, every
    // `setMultipleValues({cdnUrl,cdnUrlModifiers})` triggers TWO validator
    // runs, and tests that assert `calls.length === N+1` see N+2.
    let pending = false;
    const onChange = (): void => {
      if (this._writingErrors) return;
      if (pending) return;
      pending = true;
      queueMicrotask(() => {
        pending = false;
        if (this._writingErrors) return;
        this._validateEntry(entry);
        this._scheduleCollectionRefresh();
      });
    };
    const unsubs = [
      entry.subscribe('file', onChange),
      entry.subscribe('externalUrl', onChange),
      entry.subscribe('fileName', onChange),
      entry.subscribe('fileSize', onChange),
      entry.subscribe('mimeType', onChange),
      entry.subscribe('isImage', onChange),
      entry.subscribe('fileInfo', onChange),
      entry.subscribe('cdnUrl', onChange),
      entry.subscribe('cdnUrlModifiers', onChange),
      entry.subscribe('isUploading', onChange),
    ];
    this._entrySubs.set(entry.internalId, unsubs);
  }

  // Coalesce many per-entry change events into one collection-error pass.
  // 1000 uploads completing back-to-back used to cost O(N²); now O(N).
  private _refreshScheduled = false;
  private _scheduleCollectionRefresh(): void {
    if (this._refreshScheduled) return;
    this._refreshScheduled = true;
    queueMicrotask(() => {
      this._refreshScheduled = false;
      this._refreshCollectionErrors();
    });
  }

  private _unobserveEntry(entry: UploadEntry): void {
    const unsubs = this._entrySubs.get(entry.internalId);
    if (unsubs) {
      for (const u of unsubs) u();
    }
    this._entrySubs.delete(entry.internalId);
    const aborts = this._asyncAborts.get(entry.internalId);
    if (aborts) {
      for (const ctrl of aborts) ctrl.abort();
    }
    this._asyncAborts.delete(entry.internalId);
    this._runPromises.delete(entry.internalId);
    this._runRecord.delete(entry.internalId);
  }

  private _ensureRunRecord(entryId: string): ValidatorRunRecord {
    let record = this._runRecord.get(entryId);
    if (!record) {
      record = { addRanFor: new WeakSet(), uploadRanFor: new WeakSet() };
      this._runRecord.set(entryId, record);
    }
    return record;
  }

  private _revalidate(): void {
    if (!this._collection) return;
    for (const entry of this._collection.items) this._validateEntry(entry);
    this._refreshCollectionErrors();
  }

  private _validateEntry(entry: UploadEntry): void {
    const snap = this._snapshotEntry(entry);
    const cfg = this._config.values as unknown as CfgShape;
    const inFlight = entry.getValue('isUploading') || entry.getValue('fileInfo');
    const uploadError = entry.getValue('uploadError');

    // Built-ins (and plugin-registered sync validators) cover file shape
    // — size, type, isImage. Once an entry is in-flight or uploaded the
    // file can't change, so skipping rerun saves cycles and preserves
    // any upload-time errors set on the entry.
    //
    // Also skip the rewrite when the entry already carries an
    // `uploadError` (server rejection, network failure): the built-in
    // pass would otherwise overwrite the upload-failure errors with
    // `[]` and break the public `errors` contract.
    let syncErrors: OutputErrorFile[] = [];
    if (!inFlight && !uploadError) {
      for (const v of this._fileValidators) {
        const r = v(snap, cfg);
        if (r) syncErrors.push(r);
      }
      this._writeErrors(entry, syncErrors);
    } else {
      // Keep non-user errors (upload failures, builtin validation) from
      // the previous run; drop `CUSTOM_ERROR` entries since the about-to-
      // run user validators are the authoritative source for them. Without
      // this, post-upload re-runs (e.g. clearing a mirror operation in the
      // image editor) leave stale user errors in `entry.errors`.
      syncErrors = entry.getValue('errors').filter((e) => e.type !== 'CUSTOM_ERROR');
    }

    // User validators (`config.fileValidators`) run on every observed
    // change including post-upload transitions so consumers can revalidate
    // on `cdnUrl` / `fileInfo`. v1 parity.
    const user = this._userFileValidators();
    if (user.length === 0) return;
    this._runUserValidatorsAsync(entry, user, syncErrors);
  }

  private _writeErrors(entry: UploadEntry, errors: OutputErrorFile[]): void {
    const current = entry.getValue('errors');
    if (errorListEqual(current, errors)) return;
    this._writingErrors = true;
    try {
      entry.setValue('errors', errors);
    } finally {
      this._writingErrors = false;
    }
  }

  /**
   * Run user-supplied validators on a queue with concurrency, per-entry
   * AbortController, and per-validator timeout. While the pass is in
   * flight, the entry carries `isQueuedForValidation` then
   * `isValidationPending` so the UI shows a spinner. Aborted runs (entry
   * removed or re-validated) drop their results silently.
   */
  private _runUserValidatorsAsync(
    entry: UploadEntry,
    validators: NonNullable<FileValidators>,
    syncErrors: OutputErrorFile[],
  ): void {
    // Filter validators by `runOn`: 'add' fires once on initial pass,
    // 'upload' fires once when the entry first transitions to having
    // `fileInfo`, 'change' (default) fires on every observed change.
    const record = this._ensureRunRecord(entry.internalId);
    const hasFileInfo = entry.getValue('fileInfo') !== null;
    const eligible: NonNullable<FileValidators> = validators.filter((v) => {
      const fn = unwrapUserValidator(v) as unknown as object;
      switch (validatorRunOn(v)) {
        case 'add':
          if (record.addRanFor.has(fn)) return false;
          record.addRanFor.add(fn);
          return true;
        case 'upload':
          if (!hasFileInfo) return false;
          if (record.uploadRanFor.has(fn)) return false;
          record.uploadRanFor.add(fn);
          return true;
        default:
          return true;
      }
    });
    if (eligible.length === 0) {
      // Still update entry errors so a previous run's results don't stick
      // around when builtin validators recompute.
      this._writeErrors(entry, syncErrors);
      return;
    }

    // v1 parity: do NOT abort the previous run on a new change. Aborting
    // would drop the in-flight validator's pending result — e.g. a 500ms
    // async validator that ultimately produces an error gets cancelled by
    // every state change that races inside its delay (upload start,
    // completion, etc.). Instead, serialize via a per-entry promise chain
    // and let each run settle before the next one starts. The abort
    // controller stays scoped to a single run; on entry removal every
    // live run's controller in the per-entry set gets aborted at once.
    const abort = new AbortController();
    let aborts = this._asyncAborts.get(entry.internalId);
    if (!aborts) {
      aborts = new Set();
      this._asyncAborts.set(entry.internalId, aborts);
    }
    aborts.add(abort);

    entry.setValue('isQueuedForValidation', true);
    const cfg = this._config.values as unknown as CfgShape;
    const timeoutMs = cfg.validationTimeout ?? DEFAULT_VALIDATION_TIMEOUT_MS;
    // User validators receive v1-shaped OutputFileEntry, not ValidationItem.
    const outputItem = getOutputItem(entry);
    const previousRun = this._runPromises.get(entry.internalId) ?? Promise.resolve();

    const runPromise = (async () => {
      try {
        await previousRun;
      } catch {
        // Previous run failures don't stop subsequent runs.
      }
      if (abort.signal.aborted) return;
      // Entry may have been removed while we waited for the previous run.
      if (!this._collection?.has(entry.internalId)) return;
      try {
        await this._asyncQueue.add(async () => {
          if (abort.signal.aborted) return;
          if (!this._collection?.has(entry.internalId)) return;
          entry.setMultipleValues({
            isQueuedForValidation: false,
            isValidationPending: true,
          });
          const asyncErrors: OutputErrorFile[] = [];
          const userApi = this._userApi?.();
          for (const v of eligible) {
            if (abort.signal.aborted) return;
            const fn = unwrapUserValidator(v) as unknown as (
              entry: OutputFileEntry,
              api: unknown,
              opts?: { signal: AbortSignal },
            ) => OutputErrorFile | undefined | Promise<OutputErrorFile | undefined>;
            try {
              const result = await raceWithTimeout(
                Promise.resolve(fn(outputItem, userApi ?? cfg, { signal: abort.signal })),
                timeoutMs,
                abort.signal,
              );
              if (result) {
                asyncErrors.push({
                  ...(result as OutputErrorFile),
                  type: (result as { type?: string }).type ?? 'CUSTOM_ERROR',
                } as OutputErrorFile);
              }
            } catch (err) {
              if (abort.signal.aborted) return;
              console.warn('[uploadcare] user file validator threw', err);
            }
          }
          if (abort.signal.aborted) return;
          if (!this._collection?.has(entry.internalId)) return;
          entry.setValue('isValidationPending', false);
          this._writeErrors(entry, [...syncErrors, ...asyncErrors]);
          this._scheduleCollectionRefresh();
        });
      } catch (err) {
        if (abort.signal.aborted) return;
        console.warn('[uploadcare] validation queue task failed', err);
        entry.setMultipleValues({
          isQueuedForValidation: false,
          isValidationPending: false,
        });
      } finally {
        const set = this._asyncAborts.get(entry.internalId);
        if (set) {
          set.delete(abort);
          if (set.size === 0) this._asyncAborts.delete(entry.internalId);
        }
      }
    })();
    // Replace the chain's tail with this run; any concurrent later call
    // will overwrite again. `_runPromises` is cleared on entry removal
    // (and on `destroy`); we don't clean up here because doing so would
    // require a stale-identity check, and a resolved Promise sitting in
    // the map costs nothing — the next `previousRun` await resolves
    // synchronously.
    this._runPromises.set(entry.internalId, runPromise);
  }

  private _refreshCollectionErrors(): void {
    if (!this._collection) return;
    // Snapshots are only needed for user-supplied validators that accept
    // ValidationItem[]; built-ins read just the count. Skip the
    // 13×N getValue map when nothing custom is registered.
    const entries = this._collection.items;
    const needsSnapshots = this._collectionValidators.length > this._builtinCount.collection;
    const items = needsSnapshots
      ? entries.map((e) => this._snapshotEntry(e))
      : (entries as unknown as ValidationItem[]);
    let errors = this.runForCollection(items);
    let someFailed = false;
    for (const e of entries) {
      if (e.getValue('errors').length > 0) {
        someFailed = true;
        break;
      }
    }
    if (someFailed) {
      errors = [
        ...errors,
        {
          type: 'SOME_FILES_HAS_ERRORS',
          // v1 parity — `some-files-were-not-uploaded` is the locale key used
          // by `validateCollectionUploadError`. Form inputs surface this via
          // `setCustomValidity`, so the message must match v1 exactly.
          message: this._locale.t('some-files-were-not-uploaded'),
          payload: {},
        },
      ];
    }
    if (collectionErrorListEqual(this._collectionErrors, errors)) return;
    this._collectionErrors = errors;
    this._listeners.notify();
  }

  private _snapshotEntry(entry: UploadEntry): ValidationItem {
    const errors = entry.getValue('errors');
    const file = entry.getValue('file');
    const isRemoved = entry.getValue('isRemoved');
    const isUploading = entry.getValue('isUploading');
    const fileInfo = entry.getValue('fileInfo');
    const status: ValidationItem['status'] = isRemoved
      ? 'removed'
      : errors.length > 0
        ? 'failed'
        : fileInfo
          ? 'success'
          : isUploading
            ? 'uploading'
            : 'idle';
    return {
      internalId: entry.internalId,
      name: entry.getValue('fileName'),
      size: entry.getValue('fileSize'),
      file: file instanceof File ? file : null,
      externalUrl: entry.getValue('externalUrl'),
      uuid: entry.getValue('uuid'),
      cdnUrl: entry.getValue('cdnUrl'),
      cdnUrlModifiers: entry.getValue('cdnUrlModifiers'),
      mimeType: entry.getValue('mimeType'),
      isImage: entry.getValue('isImage'),
      status,
      uploadProgress: entry.getValue('uploadProgress'),
      errors: errors.map((e) => String(e?.message ?? e)),
      source: entry.getValue('source'),
    };
  }

  // ─── Built-in validators ──────────────────────────────────────────────

  private _builtinMaxSize: FileValidator = (item, cfg) => {
    const max = (cfg as CfgShape).maxLocalFileSizeBytes;
    if (!max || item.size === null || item.size <= max) return undefined;
    return {
      type: 'FILE_SIZE_EXCEEDED',
      message: this._locale.t('files-max-size-limit-error', {
        maxFileSize: prettyBytes(max),
      }),
    };
  };

  private _builtinFileType: FileValidator = (item, cfg) => {
    const { imgOnly, accept } = cfg as CfgShape;
    const allowed = mergeFileTypes([...(imgOnly ? IMAGE_ACCEPT_LIST : []), accept ?? '']);
    if (!allowed.length) return undefined;
    if (!item.mimeType || !item.name) return undefined;
    const mimeOk = matchMimeType(item.mimeType, allowed);
    const extOk = matchExtension(item.name, allowed);
    if (mimeOk || extOk) return undefined;
    return {
      type: 'FORBIDDEN_FILE_TYPE',
      message: this._locale.t('file-type-not-allowed'),
    };
  };

  private _builtinIsImage: FileValidator = (item, cfg) => {
    if (!(cfg as CfgShape).imgOnly) return undefined;
    if (item.isImage) return undefined;
    // Skip when we don't know yet (no mime + not uploaded).
    if (!item.uuid && item.externalUrl) return undefined;
    if (!item.uuid && !item.mimeType) return undefined;
    return {
      type: 'NOT_AN_IMAGE',
      message: this._locale.t('images-only-accepted'),
    };
  };

  private _builtinMultiple: CollectionValidator = (items, cfg) => {
    const c = cfg as CfgShape;
    const total = items.length;
    const min = c.multiple ? (c.multipleMin ?? 0) : 0;
    const max = c.multiple ? (c.multipleMax ?? 0) : 1;
    if (min && total < min) {
      return {
        type: 'TOO_FEW_FILES',
        message: this._locale.t('files-count-limit-error-too-few', {
          min,
          max,
          total,
        }),
        payload: { total, min, max },
      };
    }
    if (max && total > max) {
      return {
        type: 'TOO_MANY_FILES',
        message: this._locale.t('files-count-limit-error-too-many', {
          min,
          max,
          total,
        }),
        payload: { total, min, max },
      };
    }
    return undefined;
  };
}

function errorListEqual(a: readonly OutputErrorFile[], b: readonly OutputErrorFile[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i]?.type !== b[i]?.type || a[i]?.message !== b[i]?.message) return false;
  }
  return true;
}

function collectionErrorListEqual(a: readonly OutputErrorCollection[], b: readonly OutputErrorCollection[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i]?.type !== b[i]?.type || a[i]?.message !== b[i]?.message) return false;
  }
  return true;
}

/**
 * Race a promise against a timeout AND an abort signal. Resolves with the
 * promise's value when it settles first; rejects with `Timeout` after
 * `timeoutMs`, or with `AbortError` when the signal fires.
 */
function raceWithTimeout<T>(promise: Promise<T>, timeoutMs: number, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let timer: number | undefined;
    let settled = false;
    const onAbort = (): void => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) window.clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    if (signal.aborted) return onAbort();
    signal.addEventListener('abort', onAbort, { once: true });
    timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', onAbort);
      reject(new Error(`Validator timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    promise.then(
      (v) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        signal.removeEventListener('abort', onAbort);
        resolve(v);
      },
      (err) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        signal.removeEventListener('abort', onAbort);
        reject(err);
      },
    );
  });
}
